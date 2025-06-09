// Canvas and context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');
const canvasArea = document.getElementById('canvasArea');

// State management
let isDrawing = false;
let currentTool = 'brush';
let currentBlendMode = 'source-over';
let brushSize = 5;
let opacity = 100;
let hardness = 100;
let foregroundColor = '#000000';
let backgroundColor = '#ffffff';
let startX, startY;
let undoStack = [];
let redoStack = [];

// Pan and Zoom state
let panX = 0;
let panY = 0;
let zoomLevel = 1.0; // 1.0 = 100%
let isPanning = false;
let panStartX, panStartY; // Mouse position when pan started



// Initialize canvas
function initCanvas() {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
    updateCanvasTransform();
    updateToolCursor();
}

// Save state for undo/redo
function saveState() {
    // Save the entire canvas as a data URL
    undoStack.push(canvas.toDataURL());
    // Limit undo stack size to prevent excessive memory usage
    if (undoStack.length > 50) undoStack.shift();
    redoStack = []; // Clear redo stack on new action
}

// Undo functionality
function undo() {
    if (undoStack.length > 1) {
        // Move current state to redo stack
        redoStack.push(undoStack.pop());
        // Get the previous state from undo stack
        const imageData = undoStack[undoStack.length - 1];
        const img = new Image();
        img.onload = () => {
            // Clear canvas and draw the previous state
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = imageData;
    }
}

// Redo functionality
function redo() {
    if (redoStack.length > 0) {
        const imageData = redoStack.pop();
        undoStack.push(imageData); // Move state back to undo stack
        const img = new Image();
        img.onload = () => {
            // Clear canvas and draw the restored state
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = imageData;
    }
}

// Helper to get transformed canvas coordinates from mouse event
function getTransformedCoords(e) {
    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates relative to the canvas *wrapper* (which is transformed)
    // Then convert those coordinates back to the untransformed canvas space
    const x = (e.clientX - rect.left - panX) / zoomLevel;
    const y = (e.clientY - rect.top - panY) / zoomLevel;
    return { x, y };
}

// Drawing functions
function startDrawing(e) {
    if (currentTool === 'zoom' || currentTool === 'pan') return;

    isDrawing = true;
    const { x, y } = getTransformedCoords(e);
    startX = x;
    startY = y;

    setupBrush();

    if (currentTool === 'brush' || currentTool === 'pencil' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        draw(e); // Draw immediate dot/line
    }
}

function draw(e) {
    if (!isDrawing || currentTool === 'zoom' || currentTool === 'pan') return;

    const { x, y } = getTransformedCoords(e);
    updateCoordinates(x, y);

    if (currentTool === 'brush' || currentTool === 'pencil') {
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath(); // Start new path for continuous drawing
        ctx.moveTo(x, y);
    } else if (currentTool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath(); // Start new path for continuous erasing
        ctx.moveTo(x, y);
    }
}

function stopDrawing(e) {
    if (!isDrawing) return; // Prevent saving state if no drawing occurred
    isDrawing = false;

    if (currentTool === 'zoom' || currentTool === 'pan') {
        // Pan/Zoom actions don't save state on mouse up
        return;
    }

    const { x: endX, y: endY } = getTransformedCoords(e);

    if (currentTool === 'line') {
        setupBrush();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    } else if (currentTool === 'rectangle') {
        setupBrush();
        ctx.beginPath();
        // Ensure correct rectangle drawing for all directions
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        ctx.rect(rectX, rectY, rectWidth, rectHeight);
        ctx.stroke();
    } else if (currentTool === 'circle') {
        setupBrush();
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    saveState(); // Save state after a completed drawing action
}

function setupBrush() {
    // Set global composite operation for blending or erasing
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : currentBlendMode;
    // Eraser uses a transparent color, otherwise use foreground color
    ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : foregroundColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity / 100; // Apply opacity

    // Apply softness/shadow based on hardness and zoom level
    if (hardness < 100 && currentTool !== 'pencil') {
        // Shadow blur scales with zoom for consistent visual effect
        ctx.shadowColor = currentTool === 'eraser' ? 'rgba(0,0,0,0.5)' : foregroundColor;
        ctx.shadowBlur = ((100 - hardness) / 10) / zoomLevel; // Inverse scaling for shadow blur
    } else {
        ctx.shadowBlur = 0; // No shadow for full hardness or pencil
    }
}

// Update coordinate display in status bar
function updateCoordinates(x, y) {
    document.getElementById('coordinates').textContent = `${Math.round(x)}, ${Math.round(y)}`;
}

// Update the CSS transform for pan and zoom
function updateCanvasTransform() {
    canvasWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    document.getElementById('zoomStatus').textContent = `${Math.round(zoomLevel * 100)}% Zoom`;
    document.getElementById('zoomInput').value = Math.round(zoomLevel * 100);
    document.getElementById('zoomSlider').value = Math.round(zoomLevel * 100);
    updateBrushPreview(); // Update brush preview as its size depends on zoom
}

// Set cursor based on active tool
function updateToolCursor() {
    const cursorClass = `cursor-${currentTool}`;
    // Remove all cursor classes
    canvasArea.className = 'canvas-area';
    // Add the new cursor class
    canvasArea.classList.add(cursorClass);
}

// Event listeners for drawing (general)
canvas.addEventListener('mousedown', (e) => {
    if (currentTool === 'pan') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        canvasArea.classList.add('grabbing'); // Visual feedback for grabbing
    } else if (currentTool === 'zoom') {
        // No specific mousedown action for zoom tool, handled by click or wheel
    } else {
        startDrawing(e);
    }
});

canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getTransformedCoords(e);
    updateCoordinates(x, y);

    if (isPanning) {
        // Adjust pan position based on mouse movement
        panX += (e.clientX - panStartX);
        panY += (e.clientY - panStartY);
        panStartX = e.clientX;
        panStartY = e.clientY;
        updateCanvasTransform();
    } else {
        draw(e);
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isPanning) {
        isPanning = false;
        canvasArea.classList.remove('grabbing');
    } else {
        stopDrawing(e);
    }
});

canvas.addEventListener('mouseout', (e) => {
    // Stop drawing or panning if mouse leaves canvas area
    if (isDrawing) {
        stopDrawing(e);
    }
    if (isPanning) {
        isPanning = false;
        canvasArea.classList.remove('grabbing');
    }
});

// Mouse wheel for zooming
canvasArea.addEventListener('wheel', (e) => {
    e.preventDefault(); // Prevent page scrolling

    const oldZoomLevel = zoomLevel;
    const zoomAmount = 0.1; // How much to zoom per wheel tick

    // Determine zoom direction
    if (e.deltaY < 0) {
        // Zoom in
        zoomLevel = Math.min(5.0, zoomLevel + zoomAmount);
    } else {
        // Zoom out
        zoomLevel = Math.max(0.1, zoomLevel - zoomAmount);
    }

    // Calculate mouse position relative to canvas wrapper
    const rect = canvasWrapper.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    // Adjust pan to zoom around the mouse cursor
    panX = mouseCanvasX - ((mouseCanvasX - panX) * (zoomLevel / oldZoomLevel));
    panY = mouseCanvasY - ((mouseCanvasY - panY) * (zoomLevel / oldZoomLevel));

    updateCanvasTransform();
});


// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tool-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        document.getElementById('currentTool').textContent = btn.dataset.tooltip.split(' (')[0] + ' Tool';
        updateToolCursor();
    });
});

// Blend mode selection
document.querySelectorAll('.blend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.blend-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentBlendMode = btn.dataset.blend;
    });
});

// Property controls - Sync sliders and inputs
function syncSliderAndInput(sliderId, inputId, callback) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    slider.addEventListener('input', (e) => {
        input.value = e.target.value;
        callback(e.target.value);
    });

    input.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // Clamp value to min/max of slider
        value = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), value));
        input.value = value; // Update input value if it was out of bounds
        slider.value = value;
        callback(value);
    });
}

syncSliderAndInput('brushSize', 'brushSizeInput', (value) => {
    brushSize = parseInt(value);
    updateBrushPreview();
    updateBrushInfo();
});

syncSliderAndInput('opacity', 'opacityInput', (value) => {
    opacity = parseInt(value);
    updateBrushInfo();
});

syncSliderAndInput('hardness', 'hardnessInput', (value) => {
    hardness = parseInt(value);
});

// Zoom slider and input sync
syncSliderAndInput('zoomSlider', 'zoomInput', (value) => {
    const oldZoomLevel = zoomLevel;
    zoomLevel = parseInt(value) / 100; // Convert percentage back to decimal

    // Recalculate pan to keep center
    // This is a simplified centering, a true "zoom around center" requires more complex logic
    // based on the viewport center, but this is good for slider input.
    const currentCanvasWidth = canvas.width * oldZoomLevel;
    const currentCanvasHeight = canvas.height * oldZoomLevel;
    const newCanvasWidth = canvas.width * zoomLevel;
    const newCanvasHeight = canvas.height * zoomLevel;

    // Adjust pan to keep the center of the canvas in view
    panX -= (newCanvasWidth - currentCanvasWidth) / 2;
    panY -= (newCanvasHeight - currentCanvasHeight) / 2;

    updateCanvasTransform();
});


function updateBrushPreview() {
    const preview = document.getElementById('brushPreview');
    // Scale brush preview size based on zoom level, but keep it within limits
    const size = Math.max(4, Math.min(30, brushSize * zoomLevel));
    preview.style.width = size + 'px';
    preview.style.height = size + 'px';
    preview.style.backgroundColor = foregroundColor;
}

function updateBrushInfo() {
    document.getElementById('brushInfo').textContent = `Size: ${brushSize}px, Opacity: ${opacity}%`;
}

// Color pickers
document.getElementById('foregroundColor').addEventListener('input', (e) => {
    foregroundColor = e.target.value;
    updateBrushPreview();
});

document.getElementById('backgroundColor').addEventListener('input', (e) => {
    backgroundColor = e.target.value;
    // Clear canvas and fill with new background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState(); // Save this background change as a state
});

// Action buttons
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('clearBtn').addEventListener('click', () => {
    // Implement a custom modal for confirmation instead of window.confirm
    showCustomConfirmation('Clear Canvas', 'Are you sure you want to clear the entire canvas? This action cannot be undone.', () => {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
    });
});

document.getElementById('saveBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'canvas-artwork.png';
    link.href = canvas.toDataURL(); // Default to PNG
    link.click();
});

document.getElementById('exportBtn').addEventListener('click', () => {
    // For now, still defaults to PNG, but exportCanvas allows other formats
    exportCanvas('png', 1.0);
});

document.getElementById('newBtn').addEventListener('click', () => {
    // Implement a custom modal for confirmation instead of window.confirm
    showCustomConfirmation('New Canvas', 'Create new canvas? This will clear your current work.', () => {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        undoStack = [];
        redoStack = [];
        saveState();
    });
});

// Custom confirmation modal (replaces window.confirm)
function showCustomConfirmation(title, message, onConfirm) {
    // Create modal elements
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
                background-color: var(--secondary-dark);
                padding: 25px;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
            `;

    const modalTitle = document.createElement('h3');
    modalTitle.textContent = title;
    modalTitle.style.cssText = `
                margin-bottom: 15px;
                font-size: 16px;
                color: var(--accent-blue);
            `;

    const modalMessage = document.createElement('p');
    modalMessage.textContent = message;
    modalMessage.style.cssText = `
                margin-bottom: 25px;
                font-size: 13px;
                line-height: 1.5;
            `;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            `;

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.classList.add('header-btn', 'primary');
    confirmBtn.style.cssText += `
                padding: 8px 15px;
                font-size: 13px;
            `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('header-btn');
    cancelBtn.style.cssText += `
                padding: 8px 15px;
                font-size: 13px;
            `;

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    modalContent.appendChild(modalTitle);
    modalContent.appendChild(modalMessage);
    modalContent.appendChild(buttonContainer);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    confirmBtn.addEventListener('click', () => {
        onConfirm();
        document.body.removeChild(modalOverlay);
    });

    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
}


// Shortcuts panel
document.getElementById('shortcutsBtn').addEventListener('click', () => {
    const shortcuts = document.getElementById('shortcuts');
    shortcuts.classList.toggle('show');
});

// Close shortcuts when clicking outside
document.addEventListener('click', (e) => {
    const shortcuts = document.getElementById('shortcuts');
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    if (!shortcuts.contains(e.target) && !shortcutsBtn.contains(e.target)) {
        shortcuts.classList.remove('show');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent default for our shortcuts
    if (e.ctrlKey || e.metaKey) { // Ctrl for Windows/Linux, Meta for Mac (Command key)
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) { // Ctrl+Shift+Z for Redo
                    redo();
                } else { // Ctrl+Z for Undo
                    undo();
                }
                break;
            case 'y': // Ctrl+Y for Redo
                e.preventDefault();
                redo();
                break;
            case 's': // Ctrl+S for Save
                e.preventDefault();
                document.getElementById('saveBtn').click();
                break;
            case 'n': // Ctrl+N for New Canvas
                e.preventDefault();
                document.getElementById('newBtn').click();
                break;
            case '+': // Ctrl++ for Zoom In
                e.preventDefault();
                const currentZoomPlus = parseFloat(document.getElementById('zoomSlider').value) / 100;
                zoomLevel = Math.min(5.0, currentZoomPlus + 0.1);
                updateCanvasTransform();
                break;
            case '-': // Ctrl+- for Zoom Out
                e.preventDefault();
                const currentZoomMinus = parseFloat(document.getElementById('zoomSlider').value) / 100;
                zoomLevel = Math.max(0.1, currentZoomMinus - 0.1);
                updateCanvasTransform();
                break;
        }
    } else {
        // Tool shortcuts
        switch (e.key.toLowerCase()) {
            case 'b':
                document.querySelector('[data-tool="brush"]').click();
                break;
            case 'e':
                document.querySelector('[data-tool="eraser"]').click();
                break;
            case 'p':
                document.querySelector('[data-tool="pencil"]').click();
                break;
            case 'l':
                document.querySelector('[data-tool="line"]').click();
                break;
            case 'r':
                document.querySelector('[data-tool="rectangle"]').click();
                break;
            case 'c':
                // Only activate circle if no modifier keys are pressed
                if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    document.querySelector('[data-tool="circle"]').click();
                }
                break;
            case 'i':
                document.querySelector('[data-tool="eyedropper"]').click();
                break;
            case 'f':
                document.querySelector('[data-tool="bucket"]').click();
                break;
            case 'z':
                // Only activate zoom tool if no modifier keys (like Ctrl/Cmd for undo) are pressed
                if (!e.ctrlKey && !e.metaKey) {
                    document.querySelector('[data-tool="zoom"]').click();
                }
                break;
            case 'h':
                document.querySelector('[data-tool="pan"]').click();
                break;
            case '[': // Decrease brush size
                const currentSize = parseInt(document.getElementById('brushSize').value);
                const newSize = Math.max(1, currentSize - 5);
                document.getElementById('brushSize').value = newSize;
                document.getElementById('brushSizeInput').value = newSize;
                brushSize = newSize;
                updateBrushPreview();
                updateBrushInfo();
                break;
            case ']': // Increase brush size
                const currentSize2 = parseInt(document.getElementById('brushSize').value);
                const newSize2 = Math.min(100, currentSize2 + 5);
                document.getElementById('brushSize').value = newSize2;
                document.getElementById('brushSizeInput').value = newSize2;
                brushSize = newSize2;
                updateBrushPreview();
                updateBrushInfo();
                break;
        }
    }
});

// Touch support for mobile (basic drawing only, pan/zoom handled by gestures or default browser behavior if not overridden)
let touchStartX, touchStartY;
let lastTouchX, lastTouchY; // For panning with touch

canvas.addEventListener('touchstart', (e) => {
    // Prevent default touch behavior (e.g., scrolling, pinch-zoom by browser) for single touch
    // Multi-touch gestures for pan/zoom will be handled by the browser if not explicitly coded.
    if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();

        if (currentTool === 'pan') {
            isPanning = true;
            panStartX = touch.clientX;
            panStartY = touch.clientY;
            canvasArea.classList.add('grabbing');
        } else {
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true, // Allow event to bubble up
                cancelable: true // Allow event to be cancelled
            });
            canvas.dispatchEvent(mouseEvent);
        }
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        e.preventDefault(); // Prevent scrolling while drawing/panning
        const touch = e.touches[0];
        if (isPanning) {
            panX += (touch.clientX - panStartX);
            panY += (touch.clientY - panStartY);
            panStartX = touch.clientX;
            panStartY = touch.clientY;
            updateCanvasTransform();
        } else {
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
                cancelable: true
            });
            canvas.dispatchEvent(mouseEvent);
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    if (isPanning) {
        isPanning = false;
        canvasArea.classList.remove('grabbing');
    } else {
        const mouseEvent = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
        });
        canvas.dispatchEvent(mouseEvent);
    }
});


// Eyedropper tool functionality
function getColorAtPosition(x, y) {
    // Clamp coordinates to canvas bounds to prevent errors
    x = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
    y = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));

    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = imageData.data;
    // Convert RGB to hex color string
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Bucket fill functionality (Flood Fill)
function floodFill(startX, startY, fillColor) {
    // Get current canvas pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    // Get the color of the pixel at the starting point
    const targetColor = getPixelColor(imageData, startX, startY);
    // Convert fill color (hex) to RGB array
    const fillColorRgb = hexToRgb(fillColor);

    // If target color is already the fill color, do nothing
    if (colorsMatch(targetColor, fillColorRgb)) return;

    const stack = [[startX, startY]]; // Stack for DFS (Depth-First Search)
    const visited = new Set(); // Keep track of visited pixels to avoid infinite loops

    while (stack.length > 0) {
        const [x, y] = stack.pop(); // Get pixel from stack
        const key = `${x},${y}`; // Unique key for visited set

        // Check bounds and if already visited
        if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            continue;
        }

        const currentColor = getPixelColor(imageData, x, y);
        // If current pixel color does not match target color, skip
        if (!colorsMatch(currentColor, targetColor)) continue;

        visited.add(key); // Mark as visited
        setPixelColor(imageData, x, y, fillColorRgb); // Set new color

        // Add neighbors to the stack
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Put the modified image data back onto the canvas
    ctx.putImageData(imageData, 0, 0);
}

// Get RGB and Alpha components of a pixel from ImageData
function getPixelColor(imageData, x, y) {
    const index = (y * imageData.width + x) * 4;
    return [
        imageData.data[index],
        imageData.data[index + 1],
        imageData.data[index + 2],
        imageData.data[index + 3]
    ];
}

// Set RGB and Alpha components of a pixel in ImageData
function setPixelColor(imageData, x, y, color) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = color[0];
    imageData.data[index + 1] = color[1];
    imageData.data[index + 2] = color[2];
    imageData.data[index + 3] = 255; // Set alpha to full opaque for simplicity
}

// Compare two colors (ignoring alpha for now)
function colorsMatch(color1, color2) {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2];
}

// Convert hex color string to RGB array
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0]; // Default to black if invalid hex
}

// Handle special tool clicks (Eyedropper, Bucket)
canvas.addEventListener('click', (e) => {
    const { x, y } = getTransformedCoords(e);

    if (currentTool === 'eyedropper') {
        const color = getColorAtPosition(x, y);
        foregroundColor = color;
        document.getElementById('foregroundColor').value = color;
        updateBrushPreview(); // Update preview with new foreground color
    } else if (currentTool === 'bucket') {
        floodFill(x, y, foregroundColor);
        saveState(); // Save state after fill operation
    } else if (currentTool === 'zoom') {
        // Click to zoom in/out
        const oldZoomLevel = zoomLevel;
        const zoomFactor = e.shiftKey ? 0.9 : 1.1; // Shift+click to zoom out, click to zoom in
        zoomLevel = Math.max(0.1, Math.min(5.0, zoomLevel * zoomFactor));

        const rect = canvasWrapper.getBoundingClientRect();
        const mouseCanvasX = e.clientX - rect.left;
        const mouseCanvasY = e.clientY - rect.top;

        panX = mouseCanvasX - ((mouseCanvasX - panX) * (zoomLevel / oldZoomLevel));
        panY = mouseCanvasY - ((mouseCanvasY - panY) * (zoomLevel / oldZoomLevel));
        updateCanvasTransform();
    }
});

// Layer functionality (basic - currently just active state, no actual layer manipulation)
document.querySelectorAll('.layer-item').forEach(layer => {
    layer.addEventListener('click', () => {
        document.querySelector('.layer-item.active').classList.remove('active');
        layer.classList.add('active');
    });
});

// Canvas size adjustment
const canvasWidthInput = document.getElementById('canvasWidthInput');
const canvasHeightInput = document.getElementById('canvasHeightInput');
const applyCanvasSizeBtn = document.getElementById('applyCanvasSizeBtn');

applyCanvasSizeBtn.addEventListener('click', applyCanvasSize);

function applyCanvasSize() {
    const newWidth = parseInt(canvasWidthInput.value);
    const newHeight = parseInt(canvasHeightInput.value);

    if (isNaN(newWidth) || isNaN(newHeight) || newWidth < 100 || newHeight < 100) {
        // Replaced alert with custom modal for user feedback
        showCustomConfirmation('Invalid Dimensions', 'Please enter valid numbers for width and height (min 100px).', () => { }, true); // No confirm callback, just dismiss
        return;
    }

    // Create a temporary canvas to hold the current image data
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0); // Draw current content to temp canvas

    // Resize the main canvas
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Clear the main canvas with background color before drawing old content
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the content from the temporary canvas onto the new, resized main canvas
    // This will scale the content to fit the new dimensions
    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);

    document.getElementById('canvasSize').textContent = `${canvas.width} × ${canvas.height} px`;
    saveState(); // Save the new canvas size and content
}

// Export with different formats
function exportCanvas(format = 'png', quality = 1.0) {
    const link = document.createElement('a');
    link.download = `canvas-export-${Date.now()}.${format}`;

    if (format === 'jpg' || format === 'jpeg') {
        // Create a temporary canvas with a white background for JPEG export
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.fillStyle = '#ffffff'; // White background for JPEG
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0); // Draw existing canvas content on top
        link.href = tempCanvas.toDataURL(`image/${format}`, quality);
    } else {
        link.href = canvas.toDataURL(`image/${format}`, quality);
    }
    link.click();
}

// Initial setup calls
initCanvas();
updateBrushPreview();
updateBrushInfo();
updateCanvasTransform(); // Initialize the transform

// Auto-save functionality (every 30 seconds)
setInterval(() => {
    const autoSaveData = canvas.toDataURL();
    try {
        // In a real application, this would save to a database or local storage.
        // For this demo, we'll just log it to console.
        console.log('Auto-save completed (data not actually stored)');
    } catch (e) {
        console.log('Auto-save skipped (error or no storage available)');
    }
}, 30000);

console.log('Canvas Studio Professional initialized successfully!');
