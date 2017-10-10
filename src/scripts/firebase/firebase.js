'use strict'

/**
 * Basic Firebase helper
 */
export class FireBaseApp {
    constructor() {
        // Configuration of the application, You should update with your Keys !
        this.config = {
            apiKey: "AIzaSyDTfBu4gDSEzEoRy5BkaMXGKVkvSGxd74Y",
            authDomain: "devfest-draw.firebaseapp.com",
            databaseURL: "https://devfest-draw.firebaseio.com",
            storageBucket: "gs://devfest-draw.appspot.com",
        }

        this.app = firebase.initializeApp(this.config);
    }


}