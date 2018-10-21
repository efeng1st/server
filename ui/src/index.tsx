import * as React from 'react';
import * as ReactDOM from 'react-dom';
import 'typeface-roboto';
import 'typeface-roboto-mono';
import {initAxios} from './actions/axios';
import * as config from './config';
import Layout from './Layout';
import registerServiceWorker from './registerServiceWorker';
import * as Notifications from './stores/Notifications';
import {CurrentUser} from './stores/CurrentUser';
import {AppStore} from './stores/AppStore';
import {reaction} from 'mobx';
import {WebSocketStore} from './stores/WebSocketStore';
import {SnackManager} from './stores/SnackManager';
import {InjectProvider, StoreMapping} from './inject';
import {UserStore} from './stores/UserStore';
import {MessagesStore} from './stores/MessagesStore';
import {ClientStore} from './stores/ClientStore';

const defaultDevConfig = {
    url: 'http://localhost:80/',
};

const {port, hostname, protocol} = window.location;
const slashes = protocol.concat('//');
const url = slashes.concat(hostname.concat(':', port));
const urlWithSlash = url.endsWith('/') ? url : url.concat('/');

const defaultProdConfig = {
    url: urlWithSlash,
};

declare global {
    // tslint:disable-next-line
    interface Window {
        config: config.IConfig;
    }
}

const initStores = (): StoreMapping => {
    const snackManager = new SnackManager();
    const appStore = new AppStore(snackManager.snack);
    const userStore = new UserStore(snackManager.snack);
    const messagesStore = new MessagesStore(appStore, snackManager.snack);
    const currentUser = new CurrentUser(snackManager.snack);
    const clientStore = new ClientStore(snackManager.snack);
    const wsStore = new WebSocketStore(snackManager.snack, currentUser, messagesStore);

    return {
        appStore,
        snackManager,
        userStore,
        messagesStore,
        currentUser,
        clientStore,
        wsStore,
    };
};

(function clientJS() {
    Notifications.requestPermission();
    if (process.env.NODE_ENV === 'production') {
        config.set(window.config || defaultProdConfig);
    } else {
        config.set(window.config || defaultDevConfig);
    }
    const stores = initStores();
    initAxios(stores.currentUser, stores.snackManager.snack);

    reaction(
        () => stores.currentUser.loggedIn,
        (loggedIn) => {
            if (loggedIn) {
                stores.wsStore.listen();
            } else {
                stores.wsStore.close();
            }
            stores.appStore.refresh();
        }
    );

    stores.currentUser.tryAuthenticate();

    ReactDOM.render(
        <InjectProvider stores={stores}>
            <Layout />
        </InjectProvider>,
        document.getElementById('root')
    );
    registerServiceWorker();
})();
