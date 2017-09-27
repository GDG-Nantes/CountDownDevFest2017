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


        if (drawingMode){
            this.canvas.freeDrawingBrush = new fabric['PencilBrush'](this.canvas);
            this.canvas.freeDrawingBrush.color = BASE_COLOR;
            this.canvas.freeDrawingBrush.width = 30;
        }

        // We create the canvas
        this._drawCanvas();

    }

    /**
     * Method for changing the color of the first row
     */
    changeColor(color) {
        this.lastColor = color;
        this.rowSelect.square.changeColor(color);
        this.rowSelect.bigSquare.changeColor(color);
        this.rowSelect.rect.changeColor(color);
        this.rowSelect.vertRect.changeColor(color);
        this.canvas.renderAll();
    }

    /**
     * Serialize the canvas to a minimal object that could be treat after
     */
    export (userName, userId) {
        let resultArray = [];
        // We filter the row pegs
        let keys = Object.keys(this.brickModel)
            .filter((key) => key != this.rowSelect.square.id &&
                key != this.rowSelect.bigSquare.id &&
                key != this.rowSelect.rect.id &&
                key != this.rowSelect.vertRect.id);
        keys.forEach((key) => {
            let pegTmp = this.brickModel[key];
            resultArray.push({
                size: pegTmp.size,
                color: pegTmp.color,
                angle: pegTmp.angle,
                top: pegTmp.top - this.headerHeight,
                left: pegTmp.left,
                cellSize: this.cellSize
            });
        });
        return {
            user: userName,
            userId: userId,
            instructions: resultArray
        };
    }

    /**
     * Draw from intructions a draw
     */
    drawInstructions(instructionObject) {
        this.resetBoard();
        this.canvas.renderOnAddRemove = false;


        this.canvas.renderAll();
        this.canvas.renderOnAddRemove = true;
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