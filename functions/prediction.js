// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

// Load environment variables from `.env` file and/or OS.
require('dotenv').config();

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const fs = require('fs');
const path = require('path');
const os = require('os');
const spawn = require('child-process-promise').spawn;
const google = require('googleapis');
const GoogleAuth = require('google-auth-library');
const authFactory = new GoogleAuth();
const storage = require('@google-cloud/storage')();
const getPixels = require("get-pixels");

admin.initializeApp(functions.config().firebase);
const config = {
    imageWidth: 28,
    imageHeight: 28,
    modelName: process.env.MODEL_NAME
}

admin.database().ref(`/config`).once('value', (snapshot) => {
    if (snapshot && snapshot.val()) {
        let snapshotFb = snapshot.val();
        console.log('Load config');
        console.log(JSON.stringify(snapshotFb));
        config.modelName = snapshotFb['modelName'];
    }
});


// // The createScopedRequired method returns true when running on GAE or a local developer
// // machine. In that case, the desired scopes must be passed in manually. When the code is
// // running in GCE or a Managed VM, the scopes are pulled from the GCE metadata server.
// // See https://cloud.google.com/compute/docs/authentication for more information.
// if (authClient.createScopedRequired && authClient.createScopedRequired()) {
//   // Scopes can be specified either as an array or as a single, space-delimited string.
//   authClient = authClient.createScoped([
//     'https://www.googleapis.com/auth/cloud-platform'
//   ]);
// }

function predictPromise(event) {
    console.log('Start Predict Method !');
    // Download file locally and convert to an array.
    const bucket = storage.bucket(event.data.bucket);
    let fileurl = event.data.mediaLink;
    let gcsFilename = event.data.name;

    let filename = path.basename(gcsFilename);
    let localfile = path.join(os.tmpdir(), filename);
    console.log('Using file ' + gcsFilename);
    return bucket.file(gcsFilename).download({
        destination: localfile
    }).then(() => {
        console.log('Image will be reduce', localfile);
        // Generate a thumbnail using ImageMagick.
        return spawn('convert', [localfile, '-thumbnail', '28x28>', localfile]);
    }).then(() => {
        console.log('About to convert to grayscale...');
        return toGrayscaleArrayPromise(localfile);
    }).then((pixels) => {
        console.log('Converted to grayscale array.');
        console.log(pixels);
        console.log('ask predict api')
        return cmlePredictPromise(pixels);
    }).then((result) => {
        console.log('Prediction results: ' + JSON.stringify(result, null, '\t'));
        fs.unlinkSync(localfile);
        return result;
    });
}

function cmlePredictPromise(pixelArray, callback) {
    return new Promise((resolve, reject) => {

        try {

            google.auth.getApplicationDefault(function (err, authClient, projectId) {
                if (err) {
                    reject(err);
                    return;
                }
                if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                    authClient = authClient.createScoped([
                        'https://www.googleapis.com/auth/cloud-platform'
                    ]);
                }

                // http://google.github.io/google-api-nodejs-client/21.2.0/ml.html
                var ml = google.ml({
                    version: 'trial1'
                });
                const params = {
                    auth: authClient,
                    name: config.modelName,
                    resource: {
                        instances: [{
                            inputs: pixelArray
                        }]
                    }
                };
                console.log(params.resource);
                ml.projects.predict(params, (err, result) => {
                    if (err) {
                        reject(err);
                    } else if (result) {
                        resolve(result);
                    }
                });
            });
        } catch (e) {
            reject(e);
        }
    });
}

function toGrayscaleArrayPromise(filename) {
    return new Promise((resolve, reject) => {

        getPixels(filename, function (err, pixels) {
            if (err) {
                reject("Image load error: " + err);
                return;
            }
            console.log(`Image shape: ${pixels.shape.slice()}`);
            let width = pixels.shape[0];
            let height = pixels.shape[1];
            if (width != config.imageWidth && height != config.imageHeight) {
                // TODO: don't hardcode size in error string
                reject("Invalid image size, must be 28x28 pixels");
                return;
            }

            let grayscalePixels = new Array();
            // TODO: this could be cleaned up.
            for (let x = 0; x < pixels.shape[0]; x++) {
                for (let y = 0; y < pixels.shape[1]; y++) {
                    let red = pixels.get(x, y, 0);
                    let green = pixels.get(x, y, 1);
                    let blue = pixels.get(x, y, 2);
                    let alpha = pixels.get(x, y, 3); // ignoring for now.

                    // Convert RGB to grayscale.
                    // https://stackoverflow.com/questions/25463005/how-to-convert-an-image-to-a-0-255-grey-scale-image
                    let gray = parseInt((0.299 * red) + (0.587 * green) + (0.114 * blue));

                    grayscalePixels.push(gray);
                    if (gray < 0 || gray > 255) {
                        console.warn(`Invalid gray value of ${gray} found.`);
                    }
                }
            }
            resolve(grayscalePixels);
        });
    });
}

exports.predictPromise = predictPromise;