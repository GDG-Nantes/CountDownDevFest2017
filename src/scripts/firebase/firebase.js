'use strict'

/**
 * Basic Firebase helper
 */
export class FireBaseLegoApp {
    constructor() {
        // Configuration of the application, You should update with your Keys !
        this.config = {
            apiKey: "AIzaSyDr9R85tNjfKWddW1-N7XJpAhGqXNGaJ5k",
            authDomain: "devfest-draw.firebaseapp.com",
            databaseURL: "https://devfest-draw.firebaseio.com",
            storageBucket: "",
        }

        this.app = firebase.initializeApp(this.config);
    }


}