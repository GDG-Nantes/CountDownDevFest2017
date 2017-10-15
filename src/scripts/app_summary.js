'use strict'
import {
    FireBaseApp
} from './firebase/firebase.js';

(function () {



    function pageLoad() {

        let fireBaseApp = new FireBaseApp().app;

        fireBaseApp.database().ref('drawShow').once('value', function (snapshot) {
            if (snapshot && snapshot.val()) {
                let snapshotFb = snapshot.val();
                let keys = Object.keys(snapshotFb);
                let domParent = document.createElement('section');
                domParent.classList.add('parent-snapshots');
                keys.forEach((key) => {
                    try {
                        const drawRef = fireBaseApp.storage().ref(snapshotFb[key].urlDataStore);
                        drawRef.getDownloadURL().then(url => {
                                snapshotFb[key].dataUrl = url;
                                addElement(snapshotFb[key], domParent)
                            })
                            .catch(err => {
                                console.error(err);
                            });
                    } catch (err) {
                        console.error(err);
                    }
                });

                document.getElementById('game').appendChild(domParent);
            }

        });

    }

    function addElement(draw, domParent) {

        const imgParent = document.createElement('div');
        const img = document.createElement('img');
        img.src = draw.dataUrl;
        img.classList.add('img-ori');
        imgParent.classList.add('img-ori-parent');
        imgParent.setAttribute('data-author', draw.user);
        if (draw.tags && draw.tags.length > 0) {
            imgParent.setAttribute('data-tags', '#' + draw.tags.split("/").join(' #'));
        }
        imgParent.appendChild(img);
        imgParent.classList.add('big');
        domParent.appendChild(imgParent);
    }

    window.addEventListener('load', pageLoad);
})();