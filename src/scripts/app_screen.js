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
import {
    AudioPlayer
} from './audio/player.js';
import {
    VideoPlayer
} from './video/player.js';

(function () {

    let gameInit = false, // true if we init the legoGrid
        fireBaseApp = null, // the reference of the fireBaseApp
        drawToShow = null, // The legoGrid
        clientRect = null,
        currentKey = null, // The curent firebase draw key
        currentDraw = null, // The curent firebase draw
        minutesElt = null, // Html element for minutes
        secondsElt = null, // Html element for seconds
        countDownParentElt = null, // Html element parent of minutes and seconds
        lastLeft = false, // True if the last photo was placed at the left of the countDown
        targetDate = moment('2017-10-19, 09:00:00:000', "YYYY-MM-DD, HH:mm:ss:SSS"), // The timeout date
        readyForNewDraw = true,
        audioPlayer = null,
        endShow = false;

    function initGame() {

        drawToShow = document.getElementById('drawToShow');

        getNextDraw();

    }

    /**
     * Generate a snapshot of the draw with a flash effect
     */
    function generateSnapshot(user, tags, dataUrl) {
        // We start our flash effect
        let rectCanvas = document.querySelector('#drawToShow').getBoundingClientRect();
        let flashDiv = document.getElementById('flash-effect')
        flashDiv.style.top = (rectCanvas.top - 250) + "px";
        flashDiv.style.left = (rectCanvas.left - 250) + "px";
        flashDiv.classList.add('flash');
        //When the animation is done (1s of opacity .7 -> 0 => ~500ms to wait)
        setTimeout(() => {
            // We create the final image
            // We create a div that we will be animate
            flashDiv.classList.remove('flash');
            let imgParent = document.createElement('div');
            let img = document.createElement('img');
            img.src = dataUrl;
            img.classList.add('img-ori');
            imgParent.classList.add('img-ori-parent');
            imgParent.setAttribute('data-author', user);
            if (tags && tags.length > 0) {
                imgParent.setAttribute('data-tags', '#' + tags.split("/").join(' #'));
            }
            imgParent.appendChild(img);
            imgParent.classList.add('big');
            // Initial Position
            imgParent.style.top = (rectCanvas.top - 45) + "px";
            imgParent.style.left = (rectCanvas.left - 45) + "px";

            document.body.appendChild(imgParent);

            // we wait a litle to set new position to the new div. The css animation will do the rest of the job
            setTimeout(function () {

                let horizontalDist = Math.floor(Math.random() * 300) + 1;
                let heightScreen = document.body.getBoundingClientRect().height;
                let verticalDist = Math.floor(Math.random() * (heightScreen - 100 - 300)) + 1;
                let angleChoice = Math.floor(Math.random() * 3) + 1;

                imgParent.classList.remove('big');
                imgParent.style.top = `calc(100px + ${verticalDist}px)`;
                imgParent.style.left = `${horizontalDist}px`;
                if (!lastLeft) { // True if the last photo was placed at the left of the countDown
                    imgParent.style.left = `calc(100vw - ${horizontalDist}px - 300px)`; // The timeout date
                }
                lastLeft = !lastLeft; // True if the last photo was placed at the left of the countDown
                let angle = angleChoice === 1 ? -9 : angleChoice === 2 ? 14 : 0; // The timeout date
                imgParent.style.transform = `rotate(${angle}deg)`;
                readyForNewDraw = true;
                getNextDraw();
            }, 100);

            // When the element is create, we clean the board
            drawToShow.style.background = '#FFFFFF';
            document.getElementById('proposition-text').innerHTML = "Waiting for a draw";

        }, 500);
    }


    function pageLoad() {

        audioPlayer = new AudioPlayer();

        fireBaseApp = new FireBaseApp().app;
        let fireBaseAuth = new FireBaseAuth({
            idDivLogin: 'login-msg',
            idNextDiv: 'game',
            idLogout: 'signout'
        });

        // Only an authenticate user can see the validated draw !
        fireBaseAuth.onAuthStateChanged((user) => {
            if (user) {
                if (!gameInit) {
                    gameInit = true;
                    initGame();
                }
            }
        });

        fireBaseApp.database().ref('drawValidated').on('child_added', getNextDraw);

        minutesElt = document.getElementById('minutes');
        secondsElt = document.getElementById('seconds');
        countDownParentElt = document.getElementById('count-down-text');

        // To remove if you want to use the target date define at the top of the class
        //targetDate = moment(); // The timeout date
        //targetDate.add(30, 'minutes');
        //targetDate.add(10, 'seconds');
        // We start our text animation
        window.requestAnimationFrame(checkTime);

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

    /**
     * Animate the text according to the current time
     */
    function checkTime() {

        if (moment().isAfter(targetDate)) {
            endShow = true;
            endCountDown();
        } else {
            let diff = targetDate.diff(moment());
            minutesElt.innerHTML = new Intl.NumberFormat("fr", {
                    minimumIntegerDigits: 2,
                    useGrouping: false
                })
                .format(Math.floor(diff / (60 * 1000)));
            secondsElt.innerHTML = new Intl.NumberFormat("fr", {
                    minimumIntegerDigits: 2,
                    useGrouping: false
                })
                .format(Math.floor(diff % (60 * 1000) / 1000));
            audioPlayer.manageSoundVolume(diff);
            if (diff < 60 * 1000) {
                countDownParentElt.classList.add('last-minute');
            }

            window.requestAnimationFrame(checkTime);
        }

    }

    /**
     * Show the next draw
     */
    function getNextDraw() {
        if (endShow || !readyForNewDraw) {
            return;
        }
        readyForNewDraw = false;
        fireBaseApp.database().ref('drawValidated').once('value', (snapshot) => {
            if (snapshot && snapshot.val()) {
                // First we get the draw
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
                        try {

                            if (!clientRect) {
                                clientRect = drawToShow.getBoundingClientRect();
                            }
                            drawToShow.style.background = `url(${url})`;
                            drawToShow.style['background-size'] = 'contain';
                            const tags = (currentDraw.tags && currentDraw.tags.length > 0) ?
                                `,\n Classification detected : ${currentDraw.tags.split("/").join(' #')}` : ''
                            document.getElementById('proposition-text').innerHTML = `Draw from ${currentDraw.user}${tags}`;
                            setTimeout(() => {
                                // After we update the draw
                                fireBaseApp.database().ref(`drawValidated/${currentKey}`).remove()
                                    .catch(err => {
                                        localStorage['Err' + currentKey] = true;
                                        console.error(err);
                                    });
                                // We finaly generate the image
                                generateSnapshot(currentDraw.user, currentDraw.tags, url)
                            }, 2000);
                        } catch (err) {
                            localStorage['Err' + currentKey] = true;
                            console.error(err);
                            readyForNewDraw = true;
                            getNextDraw();
                        }
                    })
                    .catch(err => {
                        localStorage['Err' + currentKey] = true;
                        console.error(err);
                        readyForNewDraw = true;
                        getNextDraw();
                    });

            } else {
                readyForNewDraw = true;
                document.getElementById('proposition-text').innerHTML = "Waiting for a draw";
            }

        }, (err) => {
            console.error(err);
            // error callback triggered with PERMISSION_DENIED
        });
    }


    function endCountDown() {
        const opacityElt = document.getElementById('opacity');
        opacity.style.display = '';
        setTimeout(_ => {
            opacityElt.classList.add('black');
            setTimeout(() => new VideoPlayer(opacityElt, () => {
                console.log('end');
                setTimeout(() => {
                    window.location = './assets/img/keynote.jpg';
                }, 5000);
            }).playVideo(), 4000);
        }, 100);
    }




    window.addEventListener('load', pageLoad);
})();