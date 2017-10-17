'use strict'
import {
    COLORS
} from './common/colors.js';
import {
    BASE_COLOR
} from './common/const.js';
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
        keys = null, // The keys of firenase submit draw
        snapshotFb = null, // The snapshot of submit draw
        index = 0;


    function initGame() {

        drawCanvas = new DrawCanvas('canvasDraw', true);

        $("#color-picker2").spectrum({
            showPaletteOnly: true,
            showPalette: true,
            color: BASE_COLOR,
            palette: COLORS,
            change: function (color) {
                drawCanvas.changeColor(color.toHexString());
            }
        });
    }

    function pageLoad() {

        fireBaseApp = new FireBaseApp().app;
        // We init the authentication object
        let fireBaseAuth = new FireBaseAuth({
            idDivLogin: 'login-msg',
            idNextDiv: 'hello-msg',
            idLogout: 'signout',
            idImg: "img-user",
            idDisplayName: "name-user"
        });

        /**
         * Management of Cinematic Buttons
         */
        const startBtn = document.getElementById('startBtn');

        const streamStart = Rx.Observable
            .fromEvent(startBtn, 'click')
            .map(() => 'start');


        streamStart.subscribe((state) => {
                if (state === 'start') {
                    document.getElementById('hello-msg').setAttribute("hidden", "");
                    document.getElementById('game').removeAttribute('hidden');
                    document.getElementById('color-picker2').removeAttribute('hidden');
                    if (!gameInit) {
                        document.getElementById('loading').removeAttribute('hidden');
                        // Timeout needed to start the rendering of loading animation (else will not be show)
                        setTimeout(function () {
                            gameInit = true;
                            initGame();
                            document.getElementById('loading').setAttribute('hidden', '')
                        }, 50);
                    }
                }
            })


        /**
         * Management of submission
         */
        document.getElementById('btnSubmission').addEventListener('click', () => {

            document.getElementById('uploading').style.display = '';
            // We first upload the image :
            const currentDraw = {
                user: fireBaseAuth.displayName(),
                userId: fireBaseAuth.userId()
            };
            const drawId = `${currentDraw.userId}-${Date.now()}`;
            // We prepare the storage in database
            const refDataStore = fireBaseApp.storage().ref().child(`/drawSaved/${currentDraw.userId}/${drawId}.jpg`);
            currentDraw.urlDataStore = refDataStore.fullPath;
            const base64DataUrl = drawCanvas.snapshot();

            // Upload Image
            const uploadTask = refDataStore.putString(base64DataUrl, 'data_url');
            uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, // or 'state_changed'
                (snapshot) => {
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
                (error) => {

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
                    drawCanvas.resetBoard();
                    document.getElementById('uploading').style.display = 'none';
                    document.querySelector('#snackbar-container').MaterialSnackbar.showSnackbar({
                        message: 'Drawing not submited, there was a problem.'
                    });
                },
                () => {
                    // Upload completed successfully, now we can get the download URL
                    console.log('upload complete')
                    // When we submit a draw, we save it on firebase tree
                    fireBaseApp.database().ref(`/drawUpload/${drawId}`).set(currentDraw);
                    drawCanvas.resetBoard();
                    document.getElementById('uploading').style.display = 'none';
                    document.querySelector('#snackbar-container').MaterialSnackbar.showSnackbar({
                        message: 'Drawing submited! Thanks!'
                    });
                });

        });

        /**
         * Management of menu items
         */

        const menuGame = document.getElementById('menu-game');
        const menuCreations = document.getElementById('menu-creations');
        const menuSlider = document.getElementById('slider-width');
        const menuBrush = document.getElementById('menuBrush');
        const menuClear = document.getElementById('menuClear');


        const streamGame = Rx.Observable
            .fromEvent(menuGame, 'click')
            .map(() => 'game');

        const streamCreations = Rx.Observable
            .fromEvent(menuCreations, 'click')
            .map(() => 'creations');

        const streamBrush = Rx.Observable
            .fromEvent(menuBrush, 'click')
            .map(() => 'brush');

        const streamClear = Rx.Observable
            .fromEvent(menuClear, 'click')
            .map(() => 'clear');

        streamGame.merge(streamCreations)
            .merge(streamBrush)
            .merge(streamClear)
            .subscribe((state) => {
                if (state === 'game') {
                    manageStateDivs(state);

                } else if (state === 'creations') {
                    manageStateDivs(state);

                    fireBaseApp.database().ref(`drawSaved/${fireBaseAuth.userId()}`).once('value', (snapshot) => {
                        if (snapshot && snapshot.val()) {
                            console.log(snapshot.val());
                            snapshotFb = snapshot.val();
                            keys = Object.keys(snapshotFb);
                            index = 0;
                            draw();
                        } else {
                            console.log('no draw !');
                            document.querySelector('#snackbar-container').MaterialSnackbar.showSnackbar({
                                message: 'You haven\'t yet submit drawings.'
                            });
                            document.getElementById('btnLeft').disabled = true;
                            document.getElementById('btnRight').disabled = true;
                        }

                    }, (err) => {
                        document.querySelector('#snackbar-container').MaterialSnackbar.showSnackbar({
                            message: 'An error happen while getting drawings'
                        });
                        manageStateDivs('game');
                        console.error(err);
                        // error callback triggered with PERMISSION_DENIED
                    });

                } else if (state === 'brush') {
                    if (drawCanvas.getEraserMode()){
                        document.querySelector('#menuBrush i').innerHTML = 'brush';
                    }else{
                        document.querySelector('#menuBrush i').innerHTML = 'healing';

                    }
                    drawCanvas.toggleEraser();

                } else if (state === 'clear') {
                    drawCanvas.resetBoard();
                }
            });

        menuSlider.addEventListener('change', (event) => {
            drawCanvas.changeWidth(menuSlider.value);
        });


        /**
         * Management of Buttons for changing of draw
         */

        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');

        const streamBtnLeft = Rx.Observable
            .fromEvent(btnLeft, 'click', () => index = Math.max(index - 1, 0));
        const streamBtnRight = Rx.Observable
            .fromEvent(btnRight, 'click', () => index = Math.min(index + 1, keys.length - 1));

        streamBtnLeft.merge(streamBtnRight).subscribe(draw);


    }

    function manageStateDivs(state) {
        switch (state) {
            case 'game':
                document.querySelector('.page-content').removeAttribute('hidden');
                document.getElementById('submitted').setAttribute('hidden', '');
                document.getElementById('menu-game').setAttribute('hidden', '');
                document.getElementById('menu-creations').removeAttribute('hidden');
                document.querySelector('.mdl-layout__drawer').classList.remove('is-visible');
                document.querySelector('.mdl-layout__obfuscator').classList.remove('is-visible');
                break;
            case 'creations':
                document.querySelector('.page-content').setAttribute('hidden', '');
                document.getElementById('submitted').removeAttribute('hidden');
                document.getElementById('menu-game').removeAttribute('hidden');
                document.getElementById('menu-creations').setAttribute('hidden', '');
                document.querySelector('.mdl-layout__drawer').classList.remove('is-visible');
                document.querySelector('.mdl-layout__obfuscator').classList.remove('is-visible');
                break;

        }
    }

    /**
     * Show a draw and show it's state : Rejected or Accepted
     */
    function draw() {
        let draw = snapshotFb[keys[index]];
        let imgSubmission = document.getElementById('imgSubmission');
        let parentImg = imgSubmission.parentElement;

        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');

        if (index === 0) {
            btnLeft.disabled = true;
        } else {
            btnLeft.removeAttribute('disabled');
        }

        if (index === keys.length - 1) {
            btnRight.disabled = true;
        } else {
            btnRight.removeAttribute('disabled');
        }

        const drawRef = fireBaseApp.storage().ref(draw.urlDataStore);
        drawRef.getDownloadURL().then(url => {
                imgSubmission.src = url;
                if (draw.accepted && !parentImg.classList.contains('accepted')) {
                    parentImg.classList.remove('rejected');
                    parentImg.classList.add('accepted');
                } else if (!draw.accepted) {
                    parentImg.classList.remove('accepted');
                    parentImg.classList.add('rejected');
                }
            })
            .catch(err => {
                console.error(err);

            });



    }


    window.addEventListener('load', pageLoad);

    /* SERVICE_WORKER_REPLACE
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker-phone.js', {scope : location.pathname}).then(function(reg) {
            console.log('Service Worker Register for scope : %s',reg.scope);
        });
    }
    SERVICE_WORKER_REPLACE */

})();