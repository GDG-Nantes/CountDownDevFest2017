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
        drawToShow = null, // The legoGrid
        clientRect = null,
        currentKey = null, // The curent firebase draw key
        currentDraw = null, // The curent firebase draw
        readyForNewDraw = true;


    function initGame() {
        drawToShow = document.getElementById('drawToShow');
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
        fireBaseApp.database().ref('draw').on('child_added', getNextDraw);

        // When a draw is removed (if an other moderator validate for example) on the firebase object, we look at it
        fireBaseApp.database().ref('draw').on('child_removed', ()=>{
            readyForNewDraw = true;
            getNextDraw();
        });

        // We refused the current draw
        document.getElementById('btnSubmissionRefused').addEventListener('click', () => {
            document.getElementById('proposition-text').innerHTML = "Waiting for a proposition";
            const cloneCurrentDraw = JSON.parse(JSON.stringify(currentDraw));
            /*
                When we refuse an object, we take a snapshot of it to avoid the reconstruction of the canvas.

                We then allow the author to see its draw.
            */
            cloneCurrentDraw.accepted = false;
            // we move the draw to the reject state
            fireBaseApp.database().ref(`draw/${currentKey}`).remove()
                .catch(err => {
                    localStorage['Err' + currentKey] = true;
                    console.error(err);
                });
            fireBaseApp.database().ref(`/drawSaved/${currentDraw.userId}/${currentKey}`).set(cloneCurrentDraw)
                .catch(err => {
                    localStorage['Err' + currentKey] = true;
                    console.error(err);
                });
            drawToShow.style.background = '#FFFFFF';
            readyForNewDraw = true;
            getNextDraw();
        });

        document.getElementById('btnSubmissionAccepted').addEventListener('click', () => {
            document.getElementById('proposition-text').innerHTML = "Waiting for a proposition";
            const cloneCurrentDraw = JSON.parse(JSON.stringify(currentDraw));
            // We save the state in the user tree
            cloneCurrentDraw.accepted = true;

            /*
                When we accept a draw we move it to an other branch of the firebase tree.

                The count down page could be triggered to this change
             */
            fireBaseApp.database().ref(`draw/${currentKey}`).remove();
            fireBaseApp.database().ref(`/drawSaved/${currentDraw.userId}/${currentKey}`).set(cloneCurrentDraw);
            // After this moment, it is not necessary to save the state
            delete cloneCurrentDraw.accepted;
            fireBaseApp.database().ref(`/drawValidated/${currentKey}`).set(cloneCurrentDraw);
            // And finaly we place it into validated draws in order to see the draw in the restitution scren
            delete cloneCurrentDraw.userId;
            fireBaseApp.database().ref(`/drawShow/${currentKey}`).set(cloneCurrentDraw);

            drawToShow.style.background = '#FFFFFF';
            readyForNewDraw = true;
            getNextDraw();
        });

    }

    /**
     * Calculate the next draw to show
     */
    function getNextDraw() {
        if (!readyForNewDraw) {
            return;
        }
        // Each time, we take a snapshot of draw childs and show it to the moderator
        readyForNewDraw = false;
        fireBaseApp.database().ref('draw').once('value', function (snapshot) {
            if (snapshot && snapshot.val()) {
                let snapshotFb = snapshot.val();
                let keys = Object.keys(snapshotFb);
                const index = getIndex(keys);
                if (index === -1) {
                    readyForNewDraw = true;
                    return;
                }
                currentKey = keys[index];
                currentDraw = snapshotFb[currentKey];
                const drawRef = fireBaseApp.storage().ref(currentDraw.urlDataStore);
                drawRef.getDownloadURL().then(url => {
                        if (!clientRect) {
                            clientRect = drawToShow.getBoundingClientRect();
                        }
                        drawToShow.style.background = `url(${url})`;
                        drawToShow.style['background-size'] = 'contain';
                        document.getElementById('proposition-text').innerHTML = `Proposition from ${currentDraw.user}`;
                    })
                    .catch(err => {
                        localStorage['Err' + currentKey] = true;
                        console.error(err);
                        readyForNewDraw = true;
                        getNextDraw();
                    });
            } else {
                readyForNewDraw = true;
                document.getElementById('proposition-text').innerHTML = "Waiting for a proposition";
            }

        }, function (err) {
            console.error(err);
            // error callback triggered with PERMISSION_DENIED
        });
    }

    /**Return a valid index according to ignored keys */
    function getIndex(keys) {
        let index = 0;
        let currentKeyTmp = keys[index];
        let couldReturnIndex = !localStorage['Err' + currentKeyTmp];
        while (!couldReturnIndex) {
            if (index >= keys.length) {
                couldReturnIndex = true;
                index = -1;
            } else {
                index++;
                currentKeyTmp = keys[index];
                couldReturnIndex = localStorage['Err' + currentKeyTmp];
            }
        }
        return index;
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