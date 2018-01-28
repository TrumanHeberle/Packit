(function() {
    /////////////////////////////////////////////////////////////////////////////
    /**
     * @author Truman Heberle / trumanheberle.com
     * @requires Three.js / https://threejs.org/
     * @description Parses HTML DOM tree for properly formatted elements (containing a
     * source attribute and the class "obj-file"). The src attribute should contain the
     * full file path of the 3d object file to be rendered.
     * @summary A simple way to add object files to a webpage
     **/
    //lib.VERSION = '0.0.0';
    /////////////////////////////////////////////////////////////////////////////
    /*** SETUP ***/
    // Establish the root object, `window` in the browser, or `exports` on the server.
    // Save the previous value of the `_` variable.
    let root = this;
    let previousLib = root.lib;

    // Create a safe reference to the lib object for use below.
    let lib = function(obj) {
        if (obj instanceof lib) return obj;
        if (!(this instanceof lib)) return new lib(obj);
        this.libwrapped = obj;
    };

    // Export the lib object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `lib` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = lib;
        }
        exports.lib = lib;
    } else {
        root.lib = lib;
    }

    /*** CLASSES ***/
    /**
     * Contains the HTML Dom container element, the scene, the camera, and
     * the renderer for easy, simple manipulation
     **/
    class Viewer {
        /**
         * @param {object} container - Dom element for the viewer
         **/
        constructor(container) {
            this.container = container;
            this.renderer = new THREE.WebGLRenderer({
                alpha: true
            });
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
            this.light = new THREE.DirectionalLight(0xffffff);
            this.object = null;

            // For parsing purposes
            this.attemptedASCII_STL = false;
            this.attemptedBINARY_STL = false;

            let defaultRotation = container.getAttribute("rotation")
            if (defaultRotation) {
                defaultRotation = defaultRotation.split(",");
            } else {
                defaultRotation = [0, 0, 0];
            }
            this.rotation = new THREE.Vector3(parseFloat(defaultRotation[0]), parseFloat(defaultRotation[1]), parseFloat(defaultRotation[2]));

            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setClearColor(lib.sceneColor, 1);
            this.light.position.set(0, -1, 0).normalize();
            this.scene.add(this.light);
            this.container.appendChild(this.renderer.domElement);

            let animate = function() {
                requestAnimationFrame(animate);
                this.renderer.render(this.scene, this.camera);
            }.bind(this);

            animate();
        }

        /**
         * Appropriately resizes the viewer to be the size of its container
         **/
        resize() {
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setViewport(0, 0, this.container.clientWidth, this.container.clientHeight);
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
        }

        /**
         * Renders the object from an array of triangleData
         * @param {Float32Array} vertices - object vertex data
         * @param {Float32Array} colors - rgb face color data (ommitable)
         **/
        display(vertices, colors) {
            let geometry = new THREE.BufferGeometry();
            geometry.addAttribute("position", new THREE.BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();

            let material;
            if (colors) { // Untested
                geometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));
            } else {
                material = new THREE.MeshPhongMaterial({
                    color: lib.objectColor
                });
            }

            this.object = new THREE.Mesh(geometry, material);
            this.object.rotation.x = this.rotation.x;
            this.object.rotation.y = this.rotation.y;
            this.object.rotation.z = this.rotation.z;
            this.object.name = "object";
            let current = this.scene.getObjectByName("object");
            if (current) {
                this.scene.remove(current);
            }
            this.scene.add(this.object);

            this.camera.position.x = geometry.boundingSphere.center.x;
            this.camera.position.y = geometry.boundingSphere.center.y - lib.cameraDistanceFactor * geometry.boundingSphere.radius;
            this.camera.position.z = geometry.boundingSphere.center.z;
            this.camera.lookAt(geometry.boundingSphere.center);
        }
    }

    /*** CONSTANTS ***/
    /* For each additional extension, a case must be added to the switch
    statement in lib.readFrom */
    const VALID_EXTENSIONS = ["stl", "obj"];
    /* Amount of triangles parsed per batch */
    const TRIANGLES_PER_BATCH = 500;
    /* Time between batches */
    const TIMEOUT_CONSTANT = 10;
    /* Default camera distance from bounding sphere of object
    (1 would be on the bounding sphere)*/
    const CAMERA_DISTANCE_FACTOR = 1.5;
    /* Default color if object color is unavailable */
    const DEFAULT_COLOR = "#27ae60";
    /* Default background color */
    const DEFAULT_CLEAR_COLOR = "#ffffff"

    /*** LIBRARY VARIABLES ***/
    lib.cameraDistanceFactor = CAMERA_DISTANCE_FACTOR;
    lib.objectColor = DEFAULT_COLOR;
    lib.sceneColor = DEFAULT_CLEAR_COLOR;
    lib.viewers = [];

    /*** CORE LIBRARY ***/
    /**
     * When HTML DOM content is loaded, check for all properly formatted elements
     * and append scene to the element with the loaded object
     **/
    document.addEventListener("DOMContentLoaded", function() {
        let objects = document.getElementsByClassName("obj-file");
        for (let i = 0; i < objects.length; i++) {
            lib.readFrom(objects[i]);
        }
        window.addEventListener("resize", function() {
            for (let i = 0; i < lib.viewers.length; i++) {
                lib.updateViewer(lib.viewers[i]);
            }
        });
    });

    /**
     * Create a new 3d object viewer
     * @param {object} container - DOM element to put the viewer in
     **/
    lib.createViewer = function(container) {
        let viewer = new Viewer(container);
        lib.viewers.push(viewer);
        return viewer;
    }

    /**
     * Updates the orientation of a viewer (not the scene)
     * @param {Viewer} viewer - the viewer to be updated
     **/
    lib.updateViewer = function(viewer) {
        viewer.resize();
    }

    /**
     * Check the validity of the extension then make an AJAX
     * call to retrieve the object data as a string and properly parse the data
     * @param {object} container - DOM element to put the viewer in
     **/
    lib.readFrom = function(container) {
        let path = container.getAttribute("src");
        let extension = path.split(".");
        extension = extension[extension.length - 1].toLowerCase();
        // Check if file is valid
        if (VALID_EXTENSIONS.includes(extension)) {
            let viewer = lib.createViewer(container);
            // Request file
            let xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    switch (extension) {
                        case "stl":
                            lib.parseSTL(this.response, viewer);
                            break;
                        case "obj":
                            lib.parseOBJ(this.response, viewer);
                            break;
                        default:
                            console.log("Incorrect File Type");
                    }
                }
            };
            xhttp.open("GET", path, true);
            xhttp.responseType = "blob";
            xhttp.send();
        }
    }

    //////////// STL PARSER /////////////////////////////////////////////////////
    /**
     * Parse the object data as either a binary or ASCII stl file
     * @param {blob} data - object data
     * @param {Viewer} viewer - viewer to render the object
     **/
    lib.parseSTL = function(data, viewer) {
        let indicator = data.slice(0, 6);
        let reader = new FileReader();

        reader.onload = function() {
            indicator = reader.result;
            if (indicator.includes("solid")) {
                stl_ascii(data, viewer);
            } else {
                stl_binary(data, viewer);
            }
        };

        reader.readAsText(indicator);
    }

    /**
     * Parse the object data using STL ASCII format in batches
     * @param {blob} data - object data
     * @param {Viewer} viewer - viewer to render the object
     * @throws parse error if triangle count is not an integer
     **/
    function stl_ascii(data, viewer) {
        if (viewer.attemptedASCII_STL) {
            return;
        }

        let reader = new FileReader();

        reader.onload = function() {
            try {
                let splice = reader.result.replace(/\n/g, "|").split("|");
                let triCount = (splice.length - 3) / 7;
                if (triCount !== parseInt(triCount, 10)) {
                    throw "Illegal Parse";
                }

                let batchCount = 0;
                let batchLimit = Math.floor(triCount / TRIANGLES_PER_BATCH);
                let remainder = triCount - batchLimit * TRIANGLES_PER_BATCH;
                let triangleData = new Float32Array(triCount * 9);
                runBatch();

                /**
                 * Parses one batch of triangles from data
                 **/
                function runBatch() {
                    for (let i = 0; i < TRIANGLES_PER_BATCH; i++) {
                        getTriangle(TRIANGLES_PER_BATCH * batchCount + i);
                    }
                    batchCount++;
                    if (batchCount < batchLimit) {
                        setTimeout(runBatch(), TIMEOUT_CONSTANT);
                    } else {
                        for (let i = 0; i < remainder; i++) {
                            getTriangle(TRIANGLES_PER_BATCH * batchCount + i);
                        }
                        viewer.display(triangleData);
                    }
                }

                /**
                 * Obtains the vertex data of a particular triangles
                 * @param {int} index - triangle index
                 **/
                function getTriangle(index) {
                    let v1 = splice[3 + 7 * index].split(" ");
                    let v2 = splice[4 + 7 * index].split(" ");
                    let v3 = splice[5 + 7 * index].split(" ");
                    triangleData[9 * index] = v1[v1.length - 3];
                    triangleData[9 * index + 1] = v1[v1.length - 2];
                    triangleData[9 * index + 2] = v1[v1.length - 1];
                    triangleData[9 * index + 3] = v2[v2.length - 3];
                    triangleData[9 * index + 4] = v2[v2.length - 2];
                    triangleData[9 * index + 5] = v2[v3.length - 1];
                    triangleData[9 * index + 6] = v3[v2.length - 3];
                    triangleData[9 * index + 7] = v3[v3.length - 2];
                    triangleData[9 * index + 8] = v3[v3.length - 1];
                }
            } catch (err) {
                viewer.attemptedASCII_STL = true;
                stl_binary(data, viewer);
            }
        };

        reader.readAsText(data);
    }

    /**
     * Parse the object data using STL binary format
     * @param {blob} data - object data
     * @param {Viewer} viewer - viewer to render the object
     * @throws illegal parse error if triangle count is not an integer
     **/
    function stl_binary(data, viewer) {
        if (viewer.attemptedBINARY_STL) {
            return;
        }

        let reader = new FileReader();

        reader.onload = function() {
            try {
                let arr = new Uint8Array(reader.result);

                /*// Uncomment section to access stl header
                let headerData = arr.slice(0,80);
                let header = "";
                for (i=0;i<headerData.length;i++) {
                  header += String.fromCharCode(arr[i]);
                }
                console.log(header);//*/

                let triCount = new Uint32Array(arr.buffer.slice(80, 84))[0];
                if (triCount !== parseInt(triCount, 10)) {
                    throw "Illegal Parse";
                }

                let batchCount = 0;
                let batchLimit = Math.floor(triCount / TRIANGLES_PER_BATCH);
                let remainder = triCount - batchLimit * TRIANGLES_PER_BATCH;
                let triangleData = new Float32Array(triCount * 9);
                runBatch();

                /**
                 * Parses one batch of triangles from data
                 **/
                function runBatch() {
                    for (let i = 0; i < TRIANGLES_PER_BATCH; i++) {
                        getTriangle(TRIANGLES_PER_BATCH * batchCount + i);
                    }
                    batchCount++;
                    if (batchCount < batchLimit) {
                        setTimeout(runBatch(), TIMEOUT_CONSTANT);
                    } else {
                        for (let i = 0; i < remainder; i++) {
                            getTriangle(TRIANGLES_PER_BATCH * batchCount + i);
                        }
                        viewer.display(triangleData);
                    }
                }

                /**
                 * Obtains the vertex data of a particular triangles
                 * @param {int} index - triangle index
                 **/
                function getTriangle(index) {
                    let triangle = new Float32Array(arr.buffer.slice(96 + 50 * index, 132 + 50 * index));
                    triangleData[9 * index] = triangle[0];
                    triangleData[9 * index + 1] = triangle[1];
                    triangleData[9 * index + 2] = triangle[2];
                    triangleData[9 * index + 3] = triangle[3];
                    triangleData[9 * index + 4] = triangle[4];
                    triangleData[9 * index + 5] = triangle[5];
                    triangleData[9 * index + 6] = triangle[6];
                    triangleData[9 * index + 7] = triangle[7];
                    triangleData[9 * index + 8] = triangle[8];
                }
            } catch (err) {
                viewer.attemptedBINARY_STL = true;
                stl_ascii(data, viewer);
            }
        };

        reader.readAsArrayBuffer(data);
    }

    //////////// OBJ PARSER /////////////////////////////////////////////////////

    /**
     * Parse the object data as an obj file
     * @param {blob} data - object data
     * @param {Viewer} viewer - viewer to render the object
     **/
    lib.parseOBJ = function(data, viewer) {
        // BEING IMPLEMENTED SOON
    }

    /////////////////////////////////////////////////////////////////////////////

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, lib registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party lib, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    if (typeof define === 'function' && define.amd) {
        define('lib', [], function() {
            return lib;
        });
    }
}.call(this));
