const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const prediction = require('./prediction');
const dictionnary = require('./dictionnary').dictionnary;

const admin = require('firebase-admin');
//admin.initializeApp(functions.config().firebase);


// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {

    admin.database().ref(`/config`).once('value', (snapshot) => {
        if (snapshot && snapshot.val()) {
            let snapshotFb = snapshot.val();
            let keys = Object.keys(snapshotFb);
            keys.forEach((key) => {
                response.send(JSON.stringify(snapshotFb[key]));
            });
        }
    });

});
/**
 * Method trigger when an image is upload
 */
exports.detectImage = functions.storage.object().onChange(event => {


    // [END generateThumbnailTrigger]
    // [START eventAttributes]
    const object = event.data; // The Storage object.

    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
    // [END eventAttributes]

    // [START stopConditions]
    // Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return;
    }

    // Get the file name.
    const fileName = path.basename(filePath);
    // Exit if the image is already a thumbnail.
    if (fileName.startsWith('thumb_')) {
        console.log('Already a Thumbnail.');
        return;
    }

    // Exit if this is a move or deletion event.
    if (resourceState === 'not_exists') {
        console.log('This is a deletion event.');
        return;
    }

    // Exit if file exists but is not new and is only being triggered
    // because of a metadata change.
    if (resourceState === 'exists' && metageneration > 1) {
        console.log('This is a metadata change event.');
        return;
    }
    // [END stopConditions]
    try {
        console.log('Enter in DetectImage');
        return prediction.predictPromise(event)
            .then((result) => {
                const userId = path.dirname(filePath).split(path.sep).pop();
                const drawId = path.basename(filePath, '.jpg');
                const updates = {};
                admin.database().ref(`/drawUpload/${drawId}`).once('value', (snapshot) => {
                    if (snapshot && snapshot.val()) {
                        let snapshotFb = snapshot.val();
                        snapshotFb.tags = extractTags(result);
                        admin.database().ref(`/draw/${drawId}`).set(snapshotFb)
                            .then(() => admin.database().ref(`/drawUpload/${drawId}`).remove())
                            .then(() => console.log('finish manipulating image'))
                            .catch((reason) => console.log(reason));
                    }
                });
                console.log('Prediction results from main page: ' + JSON.stringify(result, null, '\t'));
            })
            .catch((err) => {
                console.log('Error trapped !');
                console.error(err);
            });;
    } catch (e) {
        console.log('Error trapped by catch !');
        console.error(e);
    }
    return;
});

function extractTags(result) {
    const tags = [];
    if (!result.predictions) {
        return tags;
    }

    try {

        result.predictions.forEach(prediction => {
            prediction.scores.forEach((score, index) => {
                if (score > 0) {
                    tags.push(dictionnary[+prediction.classes[index]]);
                }
            });
        });
    } catch (e) {
        //TODO
    }
    return tags.join('/');
}

function setServiceAccount() {
    const serviceAccountPath = __dirname + '/service-account.json';
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] = serviceAccountPath;
}

// Set env variables for what service account to use.
setServiceAccount();