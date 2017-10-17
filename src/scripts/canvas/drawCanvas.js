'use strict'
import {
    Peg
} from '../lego_shape/peg.js';
import {
    Circle
} from '../lego_shape/circle.js';
import {
    NB_CELLS,
    HEADER_HEIGHT,
    BASE_COLOR,
    BACKGROUND_BASE_COLOR
} from '../common/const.js';


/**
 *
 * Class for Canvas Grid
 *
 */
export class DrawCanvas {
    constructor(id, drawingMode) {
        // Basic canvas
        this.canvasElt = document.getElementById(id);
        // Size of canvas
        this.canvasRect = this.canvasElt.getBoundingClientRect();
        this.canvasElt.width = this.canvasRect.width;
        // According to showRow, we will show modify the header Height
        this.headerHeight = this.showRow ? HEADER_HEIGHT : 0;
        this.canvasElt.height = this.canvasRect.width + this.headerHeight;
        // We calculate the cellsize according to the space taken by the canvas
        this.cellSize = Math.round(this.canvasRect.width / NB_CELLS);
        // toggle eraser
        this.eraserMode = false;

        // We initialize the Fabric JS library with our canvas
        this.canvas = new fabric.Canvas(id, {
            isDrawingMode: drawingMode,
            selection: false
        });
        // Object that represent the pegs on the first row
        this.rowSelect = {};
        // The current draw model (instructions, ...)
        this.brickModel = {},
            // Flag to determine if we have to create a new brick
            this.createNewBrick = false;
        this.currentBrick = null;
        this.lastColor = BASE_COLOR;


        if (drawingMode) {
            this.canvas.freeDrawingBrush = new fabric['PencilBrush'](this.canvas);
            this.canvas.freeDrawingBrush.color = BASE_COLOR;
            this.canvas.freeDrawingBrush.width = 10;
        }

        // We create the canvas
        this._drawCanvas();

    }

    /**
     * Method that change the size of pointer
     * @param {number} width
     */
    changeWidth(width) {
        this.canvas.freeDrawingBrush.width = width;
        this.canvas.renderAll();
    }

    getEraserMode(){
        return this.eraserMode;
    }

    toggleEraser() {
        this.eraserMode = !this.eraserMode;
        if (this.eraserMode) {
            this.canvas.freeDrawingBrush.color = '#FFFFFF';
        } else {
            this.canvas.freeDrawingBrush.color = this.lastColor;
        }
        this.canvas.renderAll();
    }

    /**
     * Method for changing the color of the first row
     */
    changeColor(color) {
        this.lastColor = color;
        this.canvas.freeDrawingBrush.color = color;
        this.canvas.renderAll();
    }


    drawImage(urlImage) {
        this.resetBoard();
        this.canvas.setBackgroundImage(urlImage, this.canvas.renderAll.bind(this.canvas), {
            originX: 'left',
            originY: 'top',
            width: this.canvas.width,
            height: this.canvas.height,
        });
    }

    /**
     * Clean the board and the state of the canvas
     */
    resetBoard() {
        this.brickModel = {};
        this.canvas.clear();
        this._drawCanvas();
    }

    /**
     * Generate a Base64 image from the canvas
     */
    snapshot() {
        return this.canvas.toDataURL();
    }

    /**
     *
     * Privates Methods
     *
     */


    /**
     * Init the canvas
     */
    _drawCanvas() {
        this.canvas.clear();
        this.canvas.setBackgroundColor(BACKGROUND_BASE_COLOR, this.canvas.renderAll.bind(this.canvas));
    }


}