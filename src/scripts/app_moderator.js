'use strict'
import {
    FireBaseApp
} from './firebase/firebase.js';
import {
    FireBaseAuth
} from './firebase/firebaseAuth.js';
import {
    DrawCanvas
} from './canvas/drawCanvas.js';

(function () {

    let gameInit = false, // true if we init the legoGrid
        fireBaseApp = null, // the reference of the fireBaseApp
        drawCanvas = null, // The legoGrid
        currentKey = null, // The curent firebase draw key
        currentDraw = null, // The curent firebase draw
        readyForNewDraw = true;


    function initGame() {
        drawCanvas = new DrawCanvas('canvasDraw', false);
        getNextDraw();
    }


    function pageLoad() {

        fireBaseApp = new FireBaseApp().app;
        // We init the authentication object
        let fireBaseAuth = new FireBaseAuth({
            idDivLogin: 'login-msg',
            idNextDiv: 'game',
            idLogout: 'signout'
        });

        // We start to play only when we are logged
        fireBaseAuth.onAuthStateChanged((user) => {
            if (user) {
                if (!gameInit) {
                    gameInit = true;
                    initGame();
                }
            }
        });

        // When a draw is add on the firebase object, we look at it
        fireBaseApp.database().ref('draw').on('child_added', function (data) {
            if (readyForNewDraw) {
                getNextDraw();
            }
        });

        // When a draw is removed (if an other moderator validate for example) on the firebase object, we look at it
        fireBaseApp.database().ref('draw').on('child_removed', function (data) {
            // We force a new draw because we always show the first draw
            getNextDraw();
        });

        // We refused the current draw
        document.getElementById('btnSubmissionRefused').addEventListener('click', () => {
            /*
                When we refuse an object, we take a snapshot of it to avoid the reconstruction of the canvas.

                We then allow the author to see its draw.
            */
            let dataUrl = drawCanvas.snapshot();
            currentDraw.dataUrl = dataUrl;
            delete currentDraw.instructions;
            // we move the draw to the reject state
            fireBaseApp.database().ref(`draw/${currentKey}`).remove();
            fireBaseApp.database().ref(`/drawSaved/${currentDraw.userId}`).push(currentDraw);
            drawCanvas.resetBoard();
            getNextDraw();
        });

        document.getElementById('btnSubmissionAccepted').addEventListener('click', () => {
            /*
                When we accept a draw we move it to an other branch of the firebase tree.

                The count down page could be triggered to this change
             */
            fireBaseApp.database().ref(`draw/${currentKey}`).remove();
            fireBaseApp.database().ref("/drawValidated").push(currentDraw);
            // We prepare the storage in database
            const refDataStore = fireBaseApp.storage().ref().child(`/drawSaved/${currentDraw.userId}/${Date.now()}.jpg`);
            // We also save the state in the user tree
            const dataUrl = drawCanvas.snapshot();
            currentDraw.dataUrl = dataUrl;
            currentDraw.accepted = true;
            currentDraw.urlDataStore = refDataStore.fullPath;
            // We clean the draw before to save it
            delete currentDraw.instructions;
            fireBaseApp.database().ref(`/drawSaved/${currentDraw.userId}`).push(currentDraw);
            // And finaly we place it into validated draws in order to see the draw in the restitution scren
            delete currentDraw.userId;
            fireBaseApp.database().ref("/drawShow").push(currentDraw);
            const uploadTask = refDataStore.putString(dataUrl, 'data_url');
            uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
                function (snapshot) {
                    // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
                    var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                    switch (snapshot.state) {
                        case firebase.storage.TaskState.PAUSED: // or 'paused'
                            console.log('Upload is paused');
                            break;
                        case firebase.storage.TaskState.RUNNING: // or 'running'
                            console.log('Upload is running');
                            break;
                    }
                },
                function (error) {

                    // A full list of error codes is available at
                    // https://firebase.google.com/docs/storage/web/handle-errors
                    console.error(error.code);
                    /*switch (error.code) {
                      case 'storage/unauthorized':
                        // User doesn't have permission to access the object
                        break;

                      case 'storage/canceled':
                        // User canceled the upload
                        break;


                      case 'storage/unknown':
                        // Unknown error occurred, inspect error.serverResponse
                        break;
                    }*/
                },
                function () {
                    // Upload completed successfully, now we can get the download URL
                    console.log('upload complete')
                });
            drawCanvas.resetBoard();
            getNextDraw();
        });

    }

    /**
     * Calculate the next draw to show
     */
    function getNextDraw() {
        // Each time, we take a snapshot of draw childs and show it to the moderator
        readyForNewDraw = false;
        fireBaseApp.database().ref('draw').once('value', function (snapshot) {
            if (snapshot && snapshot.val()) {
                currentDraw = snapshot;
                let snapshotFb = snapshot.val();
                let keys = Object.keys(snapshotFb);
                currentKey = keys[0];
                currentDraw = snapshotFb[keys[0]];
                drawCanvas.drawInstructions(currentDraw.instructions);
                document.getElementById('proposition-text').innerHTML = `Proposition de ${currentDraw.user}`;
            } else {
                readyForNewDraw = true;
                document.getElementById('proposition-text').innerHTML = "En attente de proposition";
            }

        }, function (err) {
            console.error(err);
            // error callback triggered with PERMISSION_DENIED
        });
    }


    window.addEventListener('load', pageLoad);

    /* SERVICE_WORKER_REPLACE
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker-moderator.js', {scope : location.pathname}).then(function(reg) {
            console.log('Service Worker Register for scope : %s',reg.scope);
        });
    }
    SERVICE_WORKER_REPLACE */
})();