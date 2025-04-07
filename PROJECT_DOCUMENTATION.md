### Project: Virtual Glasses Try-On

**1. Overview**

This web application provides a virtual try-on experience for eyeglasses. It utilizes a user's webcam, real-time facial landmark detection, and 3D model rendering to overlay different styles of glasses onto the user's face. Users can switch between various glasses models via a simple interface.

**2. How It Works (Workflow)**

The application follows these steps:

1.  **Initialization:** The webpage (`index.html`) loads, setting up the HTML structure, CSS styles, and necessary JavaScript libraries. The Three.js scene is prepared in the background.
2.  **Webcam Activation:** The user clicks the "Try it On" toggle switch.
3.  **Camera Access:** The `webcam-easy` library requests permission and accesses the user's webcam feed, displaying it in a `<video>` element.
4.  **Model Loading:** The TensorFlow.js `face-landmarks-detection` model (specifically `mediapipeFacemesh`) is loaded asynchronously. A loading indicator is shown during this process.
5.  **Real-time Detection Loop:** Once the model is loaded and the webcam is active:
    *   The application enters a loop (`requestAnimationFrame` calling `detectFaces` in `js/virtual-glasses.js`).
    *   In each frame, the current video frame from the webcam is fed into the TensorFlow.js model.
    *   The model predicts the locations of numerous facial landmarks (mesh points) for any detected faces.
6.  **3D Model Loading & Preparation:**
    *   The `.gltf` 3D model corresponding to the currently selected glasses (initially the first pair, or the one clicked in the slider) is loaded using Three.js's `GLTFLoader`.
    *   Multiple instances of the glasses model can be prepared if multiple faces are detected.
7.  **Positioning and Rendering (`drawglasses` function):**
    *   For each detected face, specific landmark points (e.g., points between the eyes, outer eye corners, nose bridge - defined in `glassesKeyPoints`) are extracted from the TensorFlow.js output.
    *   These 2D landmark coordinates (plus a depth estimate from the model) are used to calculate the appropriate 3D `position`, `scale`, and `rotation` for the glasses model in the Three.js scene.
    *   The distance between the eye landmarks is used to dynamically scale the glasses.
    *   The vector between the nose and mid-eye points helps determine the glasses' up-direction (tilt).
    *   Fine-tuning adjustments (offset, scale multiplier) are read from the `data-3d-*` attributes associated with the selected glasses in `index.html`.
    *   The Three.js renderer draws the correctly positioned and oriented 3D glasses model onto a transparent `<canvas>` element, which is precisely overlaid on top of the webcam feed display area.
8.  **Model Selection:** Clicking a different glasses thumbnail in the slider updates the `selectedglasses` variable, clears the previously rendered glasses from the scene (`clearCanvas`), loads the new `.gltf` model, and the positioning/rendering loop continues with the new model.
9.  **Webcam Deactivation:** Turning the toggle switch off stops the webcam feed, halts the detection loop, and clears the 3D glasses from the canvas.

**3. Key Technologies**

*   **HTML:** Structures the web page content (`index.html`).
*   **CSS:** Styles the appearance (Bootstrap, `style/virtual-glasses.css`).
*   **JavaScript:** Core programming language for all logic.
*   **jQuery:** Used for DOM manipulation and event handling (e.g., slider clicks, switch changes).
*   **`webcam-easy`:** JavaScript library simplifying access to the user's webcam.
*   **TensorFlow.js (`@tensorflow-models/face-landmarks-detection`):** Google's library for running machine learning models in the browser. Used here for detecting facial landmarks.
*   **Three.js:** A comprehensive 3D graphics library for creating and displaying animated 3D computer graphics in a web browser using WebGL. Used here to load (`GLTFLoader`) and render the `.gltf` glasses models.

**4. File Structure**

*   `index.html`: The main entry point and structure of the application.
*   `js/`: Contains the JavaScript code.
    *   `virtual-glasses.js`: The core application logic (webcam handling, TFJS integration, Three.js rendering, UI interactions).
    *   `webcam-ui-lib.js`: (Presumed) UI helper functions for the webcam display.
*   `style/`: Contains CSS files.
    *   `virtual-glasses.css`: Custom styles specific to this application.
*   `3dmodel/`: Contains subdirectories for each glasses model. Each subdirectory typically holds:
    *   `scene.gltf`: The 3D model file.
    *   Texture files (e.g., `.bin`, image files) referenced by the `.gltf`.
    *   A `.png` thumbnail image used in the selection slider.
*   `images/`: Contains static UI images (e.g., slider arrows).
*   `node_modules/`: Directory containing installed Node.js dependencies (specifically `three`). Created by `npm install`.
*   `package-lock.json`: Records exact dependency versions (used by `npm install`).
*   `README.md`: Project description (you might want to update this).
*   `.gitignore`: Specifies intentionally untracked files for Git.

**5. Core Logic (`js/virtual-glasses.js`)**

*   **Initialization:** Sets up event listeners (webcam switch, slider clicks), initializes Three.js `scene`, `camera`, `renderer`.
*   **`startVTGlasses()`:** Loads the TensorFlow.js face model.
*   **`detectFaces()`:** Runs in a loop, gets predictions from the TFJS model, and calls `drawglasses`.
*   **`drawglasses()`:** The core rendering logic. Takes face landmark data, calculates transform (position, scale, rotation) using landmark coordinates and `data-` attributes, updates the Three.js `glasses` object's properties, and triggers rendering.
*   **`setup3dScene()`, `setup3dCamera()`, `setup3dGlasses()`:** Functions to initialize the Three.js environment, camera perspective, lights, and load the selected `.gltf` model.
*   **`clearCanvas()`:** Removes previously rendered glasses models from the Three.js scene.
*   **Slider Logic:** Handles clicks on arrows and thumbnails to update the `selectedglasses` variable and trigger model reloading/rendering.

**6. Configuration (Adding New Glasses)**

To add new glasses:

1.  Create a new subdirectory inside `3dmodel/` (e.g., `glasses-08/`).
2.  Place the `.gltf` file (and any associated textures/`.bin` files) inside this new directory.
3.  Create a `.png` thumbnail image for the slider and place it in the directory.
4.  In `index.html`, add a new `<li>` element within the `<div id="glasses-list"><ul>`:
    ```html
    <li>
        <img src="3dmodel/glasses-08/thumbnail.png" <!-- Thumbnail image -->
             data-3d-type="gltf"
             data-3d-model-path="3dmodel/glasses-08/" <!-- Path to the model directory -->
             data-3d-model="scene.gltf" <!-- Filename of the gltf model -->
             data-3d-x="0" <!-- Initial X offset (usually 0) -->
             data-3d-y="0.3" <!-- Initial Y offset (vertical adjustment) -->
             data-3d-z="0" <!-- Initial Z offset (depth adjustment) -->
             data-3d-up="-30" <!-- Fine-tuning for vertical position/tilt -->
             data-3d-scale="0.4"> <!-- Scale multiplier -->
    </li>
    ```
5.  Adjust the `data-3d-y`, `data-3d-up`, and `data-3d-scale` attributes by trial-and-error until the new glasses model fits correctly when viewed in the application.

**7. Running the Project**

1.  Ensure you have Node.js and npm installed.
2.  Run `npm install` in the project's root directory to install the `three` dependency.
3.  Start a simple local web server from the project's root directory (e.g., `python3 -m http.server` or use VS Code's Live Server extension).
4.  Open the provided URL (e.g., `http://localhost:8000`) in your web browser. 