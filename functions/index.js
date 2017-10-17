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
    if (fileName.startsWith('convert_')) {
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
        const userId = path.dirname(filePath).split(path.sep).pop();
        const drawId = path.basename(filePath, '.jpg');

        return prediction.predictPromise(event)
            .then((result) => {
                console.log('Got result for drawId : ' + drawId);
                return updateTree(userId, drawId, result);
            })
            .catch((err) => {
                console.log('Error trapped !');
                console.error(err);
                return updateTree(userId, drawId);
            });;
    } catch (e) {
        console.log('Error trapped by catch !');
        console.error(e);
    }
    return;
});

function updateTree(userId, drawId, result) {
    return new Promise((resolve, reject) => {
        console.log('Update tree !');
        admin.database().ref(`/drawUpload/${drawId}`).once('value', (snapshot) => {
            try {
                console.log('prepare to update the tree');
                if (snapshot && snapshot.val()) {
                    let snapshotFb = snapshot.val();
                    snapshotFb.tags = extractTags(result);
                    admin.database().ref(`/draw/${drawId}`).set(snapshotFb)
                        .then(() => admin.database().ref(`/drawUpload/${drawId}`).remove())
                        .then(() => {
                            console.log('finish manipulating image');
                            resolve();
                        })
                        .catch((reason) => {
                            console.log(reason);
                            reject(reason);
                        });
                }
            } catch (e) {
                console.error(e);
                reject(e);
            }
        }, (error) => {
            console.error(error);
            reject(error);
        });
        if (result) {
            console.log('Prediction results from main page: ' + JSON.stringify(result, null, '\t'));
        } else {
            console.error('No result ! ');
        }
    });
}

function extractTags(result) {
    if (result === undefined || result === null) {
        return '';
    }

    if (!result.predictions) {
        return '';
    }

    try {
        console.log('Enter Extract Tags');
        const tags = [];
        result.predictions.forEach(prediction => {
            try {

                console.log('Will log prediction');
                console.log(JSON.stringify(prediction));
                if (prediction.classes) {
                    console.log('Classes : ' + prediction.classes + " / length dictionnary : " + dictionnary.length);
                    let isArray = false;
                    try {
                        if (Array.isArray(prediction.classes)) {
                            console.log('Classes is an array !');
                            isArray = true;
                            prediction.classes.forEach(indexClass => {
                                if (dictionnary.length > +indexClass) {
                                    tags.push(dictionnary[+indexClass]);
                                }
                            });
                        }
                    } catch (e) {
                        console.error(e);
                    }
                    if (!isArray && dictionnary.length > +prediction.classes) {
                        console.log('Classes is not an array');
                        console.log('Tag found : ' + dictionnary[+prediction.classes]);

                        tags.push(dictionnary[+prediction.classes]);
                    }
                } else {
                    console.log('No classes win :\'(');
                }
            } catch (e) {
                console.error(e);
            }
        });
        return tags.join('/');
    } catch (e) {
        return '';
    }
}

function setServiceAccount() {
    const serviceAccountPath = __dirname + '/service-account.json';
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] = serviceAccountPath;
}

// Set env variables for what service account to use.
setServiceAccount();