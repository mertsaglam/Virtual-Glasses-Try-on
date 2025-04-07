import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const webcam = new Webcam(webcamElement, 'user');
let selectedglasses = $(".selected-glasses img");
let isVideo = false;
let model = null;
let cameraFrame = null;
let detectFace = false;
let clearglasses = false;
let glassesOnImage = false;
let glassesArray = [];
let scene;
let camera;
let renderer;
let obControls;
let glassesKeyPoints = {midEye:168, leftEye:143, noseBottom:2, rightEye:372};
let showFaceMesh = false;
let faceMeshObjects = [];

$( document ).ready(function() {
    setup3dScene();
    setup3dCamera();
    setup3dGlasses();
    setupFaceMeshObject();

    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'd') {
            showFaceMesh = !showFaceMesh;
            console.log("Face mesh visibility:", showFaceMesh);
            faceMeshObjects.forEach(obj => obj.visible = showFaceMesh);
        }
    });
});

$("#webcam-switch").change(function () {
    if(this.checked){
        $('.md-modal').addClass('md-show');
        webcam.start()
            .then(result =>{
                console.log("webcam started"); 
                isVideo = true;
                cameraStarted();
                switchSource();                            
                glassesOnImage = false;
                startVTGlasses();
            })
            .catch(err => {
                displayError();
            });
    }
    else {      
        webcam.stop();
        if(cameraFrame!= null){
            clearglasses = true;
            detectFace = false;
            cancelAnimationFrame(cameraFrame);
        }
        isVideo = false;
        switchSource();
        cameraStopped(); 
        console.log("webcam stopped");
    }        
});

$("#arrowLeft").click(function () {
    let itemWidth = parseInt($("#glasses-list ul li").css("width")) 
                    + parseInt($("#glasses-list ul li").css("margin-left")) 
                    + parseInt($("#glasses-list ul li").css("margin-right"));
    let marginLeft = parseInt($("#glasses-list ul").css("margin-left"));
    $("#glasses-list ul").css({"margin-left": (marginLeft+itemWidth) +"px", "transition": "0.3s"});
});

$("#arrowRight").click(function () {
    let itemWidth = parseInt($("#glasses-list ul li").css("width")) 
    + parseInt($("#glasses-list ul li").css("margin-left")) 
    + parseInt($("#glasses-list ul li").css("margin-right"));
    let marginLeft = parseInt($("#glasses-list ul").css("margin-left"));
    $("#glasses-list ul").css({"margin-left": (marginLeft-itemWidth) +"px", "transition": "0.3s"});
});

$("#glasses-list ul li").click(function () {
    $(".selected-glasses").removeClass("selected-glasses");
    $(this).addClass("selected-glasses");
    selectedglasses = $(".selected-glasses img");
    clearCanvas();
    if(!isVideo){
        setup3dGlasses();
        setup3dAnimate();
    }
});

$('#closeError').click(function() {
    $("#webcam-switch").prop('checked', false).change();
});

function setupFaceMeshObject() {
    // Remove or comment out single faceMeshObject creation
}

async function startVTGlasses() {
    return new Promise((resolve, reject) => {
        $(".loading").removeClass('d-none');
        faceLandmarksDetection.load(faceLandmarksDetection.SupportedPackages.mediapipeFacemesh).then(mdl => {
            model = mdl;
            console.log("model loaded");
            if(isVideo && webcam.facingMode == 'user'){
                detectFace = true;
            }

            cameraFrame =  detectFaces().then(() => {
                $(".loading").addClass('d-none');
                resolve();
            });
        })
        .catch(err => {
            displayError('Fail to load face mesh model<br/>Please refresh the page to try again');
            reject(err);
        });
    });
}

async function detectFaces() {
    let inputElement = webcamElement;
    let flipHorizontal = !isVideo;
    console.log("input element", inputElement);

    await model.estimateFaces
    ({
        input: inputElement,
        returnTensors: false,
        flipHorizontal: flipHorizontal,
        predictIrises: true
    }).then(faces => {
        console.log("Detected faces:", faces); // Log the detected faces
        drawglasses(faces).then(() => {
            if(clearglasses){
                clearCanvas();
                clearglasses = false;
            }
            if(detectFace){
                cameraFrame = requestAnimFrame(detectFaces);
            }
        });
    });
}

async function drawglasses(faces){
    let faceDetected = faces.length > 0;

    if(isVideo && (glassesArray.length != faces.length) ){
        clearCanvas();
        for (let j = 0; j < faces.length; j++) {
            await setup3dGlasses();
        }
    }

    // Clear previously created faces if count changes
    if(faceMeshObjects.length !== faces.length){
        faceMeshObjects.forEach(obj => scene.remove(obj));
        faceMeshObjects = [];
        // Create new mesh objects for each face
        for(let i=0; i<faces.length; i++){
            let geometry = new THREE.BufferGeometry();
            let material = new THREE.PointsMaterial({color:0x00ff00,size:1.5,sizeAttenuation:false});
            let meshObj = new THREE.Points(geometry, material);
            meshObj.visible = showFaceMesh;
            faceMeshObjects.push(meshObj);
            scene.add(meshObj);
        }
    }

    // Update each face's mesh positions
    for(let i=0; i<faces.length; i++){
        let positions = [];
        const estimatedZ = -camera.position.z;
        for(const point of faces[i].scaledMesh){
            positions.push(point[0], -point[1], estimatedZ + point[2]);
        }
        faceMeshObjects[i].geometry.setAttribute('position',
            new THREE.Float32BufferAttribute(positions, 3));
        faceMeshObjects[i].geometry.attributes.position.needsUpdate = true;
        faceMeshObjects[i].visible = showFaceMesh;
    }

    for (let i = 0; i < faces.length; i++) {
        let glasses = glassesArray[i];
        let face = faces[i];
        if(typeof glasses !== "undefined" && typeof face !== "undefined")
        {
            let pointMidEye = face.scaledMesh[ glassesKeyPoints.midEye ];
            let pointleftEye = face.scaledMesh[ glassesKeyPoints.leftEye ];
            let pointNoseBottom = face.scaledMesh[ glassesKeyPoints.noseBottom ];
            let pointrightEye = face.scaledMesh[ glassesKeyPoints.rightEye ];

            glasses.position.x = pointMidEye[0] + parseFloat(selectedglasses.attr("data-3d-x") || 0);
            glasses.position.y = -pointMidEye[1] 
                + parseFloat(selectedglasses.attr("data-3d-up") || 0)
                + parseFloat(selectedglasses.attr("data-3d-y") || 0);
            glasses.position.z = -camera.position.z 
                + pointMidEye[2] 
                + parseFloat(selectedglasses.attr("data-3d-z") || 0);

            glasses.up.x = pointMidEye[ 0 ] - pointNoseBottom[ 0 ];
            glasses.up.y = -( pointMidEye[ 1 ] - pointNoseBottom[ 1 ] );
            glasses.up.z = pointMidEye[ 2 ] - pointNoseBottom[ 2 ];
            const length = Math.sqrt( glasses.up.x ** 2 + glasses.up.y ** 2 + glasses.up.z ** 2 );
            glasses.up.x /= length;
            glasses.up.y /= length;
            glasses.up.z /= length;

            const eyeDist = Math.sqrt(
                ( pointleftEye[ 0 ] - pointrightEye[ 0 ] ) ** 2 +
                ( pointleftEye[ 1 ] - pointrightEye[ 1 ] ) ** 2 +
                ( pointleftEye[ 2 ] - pointrightEye[ 2 ] ) ** 2
            );
            glasses.scale.x = eyeDist * parseFloat(selectedglasses.attr("data-3d-scale")) ;
            glasses.scale.y = eyeDist * parseFloat(selectedglasses.attr("data-3d-scale")) ;
            glasses.scale.z = eyeDist * parseFloat(selectedglasses.attr("data-3d-scale")) ;

            glasses.rotation.y = Math.PI;
            glasses.rotation.z = Math.PI / 2 - Math.acos( glasses.up.x );
        }
    }
    renderer.render(scene, camera);
}

function clearCanvas(){
    for( var i = scene.children.length - 1; i >= 0; i--) {
        var obj = scene.children[i];
        if(obj.type=='Group'){
            scene.remove(obj);
        }
    }
    glassesArray = [];
}

function switchSource(){
    clearCanvas();
    let containerElement
    if(isVideo){
        containerElement = $("#webcam-container");
    }else{
        containerElement = $("#image-container");
        setup3dGlasses();
    }
    setup3dCamera();
    $("#canvas").appendTo(containerElement);
    $(".loading").appendTo(containerElement);
    $("#glasses-slider").appendTo(containerElement);
}

function setup3dScene(){
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        alpha: true
    });
    var frontLight = new THREE.SpotLight( 0xffffff, 0.3 );
    frontLight.position.set( 10, 10, 10 );
    scene.add( frontLight );
    var backLight = new THREE.SpotLight( 0xffffff, 0.3  );
    backLight.position.set( 10, 10, -10)
    scene.add(backLight);
}
    

function setup3dCamera(){  
    if(isVideo){
        camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 2000 );
        let videoWidth = webcamElement.width;
        let videoHeight = webcamElement.height;
        camera.position.x = videoWidth / 2;
        camera.position.y = -videoHeight / 2;
        camera.position.z = -( videoHeight / 2 ) / Math.tan( 45 / 2 ); 
        camera.lookAt( { x: videoWidth / 2, y: -videoHeight / 2, z: 0, isVector3: true } );
        renderer.setSize(videoWidth, videoHeight);
        renderer.setClearColor(0x000000, 0);
    }
    else{  
        camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
        camera.position.set(0, 0, 1.5);
        camera.lookAt(scene.position);
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.setClearColor( 0x3399cc, 1 ); 
        obControls = new OrbitControls(camera, renderer.domElement);  
    }
    let cameraExists = false;
    scene.children.forEach(function(child){
        if(child.type=='PerspectiveCamera'){
            cameraExists = true;
        }
    });
    if(!cameraExists){
        camera.add( new THREE.PointLight( 0xffffff, 0.8 ) );
        scene.add( camera );
    }
    setup3dAnimate();
}

async function setup3dGlasses(){
    return new Promise(resolve => {
        var threeType = selectedglasses.attr("data-3d-type");
        var gltfLoader = new GLTFLoader();
        var dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.156.1/examples/jsm/libs/draco/');
        gltfLoader.setDRACOLoader(dracoLoader);
        if(threeType == 'gltf'){
            gltfLoader.setPath(selectedglasses.attr("data-3d-model-path"));
            gltfLoader.load( selectedglasses.attr("data-3d-model"), function ( object ) {
                object.scene.position.set(selectedglasses.attr("data-3d-x"), selectedglasses.attr("data-3d-y"), selectedglasses.attr("data-3d-z"));
                var scale = selectedglasses.attr("data-3d-scale");
                if(window.innerWidth < 480){
                    scale = scale * 0.5;
                }
                object.scene.scale.set(scale, scale,scale);
                scene.add( object.scene );
                glassesArray.push(object.scene);
                resolve('loaded');        
            });
        }
        else if(threeType === 'glb'){
            gltfLoader.setPath(selectedglasses.attr("data-3d-model-path"));
            gltfLoader.load(selectedglasses.attr("data-3d-model"), function ( object ) {
                object.scene.position.set(selectedglasses.attr("data-3d-x"), selectedglasses.attr("data-3d-y"), selectedglasses.attr("data-3d-z"));
                var scale = selectedglasses.attr("data-3d-scale");
                if(window.innerWidth < 480){
                    scale = scale * 0.5;
                }
                object.scene.scale.set(scale, scale,scale);
                scene.add( object.scene );
                glassesArray.push(object.scene);
                resolve('loaded');        
            });
        }
        else if(threeType === 'exr'){
            let exrLoader = new EXRLoader();
            exrLoader.setPath(selectedglasses.attr("data-3d-model-path"));
            exrLoader.load(selectedglasses.attr("data-3d-model"), function ( texture ) {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
                resolve('loaded');
            });
        }
    });
}

var setup3dAnimate = function () {
    if(!isVideo){
        requestAnimationFrame( setup3dAnimate );
        obControls.update();
    }
    renderer.render(scene, camera);
};

