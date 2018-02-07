(function() {
    /////////////////////////////////////////////////////////////////////////////
    /**
     * @author Truman Heberle / trumanheberle.com
     * Contact Via: https://twitter.com/truman_heberle
     * @requires Three.js / https://threejs.org/
     * @description Parses HTML DOM tree for properly formatted elements
     * (containing a source attribute and the appropriate class name,
     * "packit" is the default class name). The src attribute should contain
     * the full file path of the 3d object file to be rendered.
     * Ex: <div src="foo.stl" class="packit"></div>
     * @summary A simple way to add object files to a webpage
     **/
    //packit.VERSION = '0.0.0';
    /////////////////////////////////////////////////////////////////////////////
    /*** SETUP ***/
    // Establish the root object, `window` in the browser, or `exports` on the server.
    // Save the previous value of the `_` variable.
    let root = this;
    let previousLib = root.packit;

    // Create a safe reference to the packit object for use below.
    let packit = function(obj) {
        if (obj instanceof packit) return obj;
        if (!(this instanceof packit)) return new packit(obj);
        this.libwrapped = obj;
    };

    // Export the packit object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `packit` as a global object.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = packit;
        }
        exports.packit = packit;
    } else {
        root.packit = packit;
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
            this.name = container.getAttribute("src");
            this.renderer = new THREE.WebGLRenderer({alpha: true});
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
            this.controller = new Controller(this.scene, this.camera);

            // For stl parsing purposes
            this.attemptedASCII_STL = false;
            this.attemptedBINARY_STL = false;

            // Initialize
            this.renderer.setClearColor(packit.sceneColor, packit.transparency);
            this.container.appendChild(this.renderer.domElement);

            // Animate
            let animate = function() {
                requestAnimationFrame(animate);
                this.controller.update();
                this.renderer.render(this.scene, this.camera);
            }.bind(this);

            animate();
        }

        // Handled by Controller
        rotate(speedX,speedY,speedZ) {this.controller.rotate(speedX,speedY,speedZ);}
        stopRotation() {this.controller.stopRotation();}
        setRotation(rotX,rotY,rotZ) {this.controller.transitionRotation(rotX,rotY,rotZ,1);}
        transitionRotation(rotX,rotY,rotZ,transitionFrames) {this.controller.transitionRotation(rotX,rotY,rotZ,transitionFrames);}
        setColor(color) {this.controller.transitionColor(color,1);}
        transitionColor(color,transitionFrames) {this.controller.transitionColor(color,transitionFrames);}

        /**
         * Appropriately resizes the viewer to be the size of its container
         **/
        resize() {
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setViewport(0, 0, this.container.clientWidth, this.container.clientHeight);
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.controller.repositionCamera();
        }

        /**
         * Renders the object from an array of triangleData
         * @param {Float32Array} vertices - object vertex data
         * @param {String} name - object's unique name (optional: pass null)
         * @param {Uint32Array} faceIndices - face index data (optional: pass null)
         * @param {Float32Array} colors - rgb face color data (optional: pass null)
         * @param {Float32Array} uvs - uvw data (optional: pass null)
         **/
        display(vertices, name, faceIndices, colors, uvs) {
          // Create object geometry and bounds
          let geometry = new THREE.BufferGeometry();
          geometry.addAttribute("position", new THREE.BufferAttribute(vertices, 3));
          if (faceIndices) {
            geometry.setIndex(new THREE.BufferAttribute(faceIndices, 1));
          }
          if (uvs) {
            geometry.addAttribute("uv", new THREE.BufferAttribute(uvs, 3));
          }

          geometry.computeVertexNormals();

          // Create object material
          let material;
          if (colors) {
            geometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));
          } else {
            let defaultColor = new THREE.Color(this.container.getAttribute("color"));
            if (defaultColor) {
              material = new THREE.MeshPhongMaterial({
                  color: defaultColor,
                  side: THREE.DoubleSide
              });
            } else {
              material = new THREE.MeshPhongMaterial({
                  color: packit.objectColor,
                  side: THREE.DoubleSide
              });
            }
          }
          // Create object
          let object = new THREE.Mesh(geometry, material);
          if (name) {
            object.name = name;
          } else {
            object.name = this.container.getAttribute("src");
          }
          // Set default rotation
          let defaultRotation = this.container.getAttribute("rotation");
          if (defaultRotation) {
            defaultRotation = defaultRotation.split(",");
          } else {
            defaultRotation = [0,0,0];
          }
          let rotation = new THREE.Vector3(parseFloat(defaultRotation[0])*Math.PI/180, parseFloat(defaultRotation[2])*Math.PI/180, parseFloat(defaultRotation[1])*Math.PI/180);
          object.rotateOnWorldAxis(new THREE.Vector3(0,1,0), rotation.y);
          object.rotateOnWorldAxis(new THREE.Vector3(0,0,1), rotation.z);
          object.rotateOnWorldAxis(new THREE.Vector3(1,0,0), rotation.x);
          // Add object to scene
          this.controller.setObject(object);
          this.resize();
        }
    }




    /**
     * Contains the Object3D and basic control functions
     **/
    class Controller {
      /**
      * @param {THREE.Scene} scene - the scene which the controller resides
      * @param {THREE.PerspectiveCamera} camera - the camera which the controller controls
      **/
        constructor(scene, camera) {
          this.scene = scene;
          this.camera = camera;
          this.container = new THREE.Object3D();
          this.light = new THREE.DirectionalLight(0xffffff, 1.25);
          this.objects = [];
          this.bounds = null;
          this.translation = null;

          // Initialize
          this.light.position.set(0, -1, 0).normalize();
          this.scene.add(this.light);
          this.scene.add(this.container);

          // For control purposes
          this.rotationSpeed = {
            x: 0,
            y: 0,
            z: 0
          };
          this.transitionFactors = {
            color: 1,
            rotation: 1
          }
          this.target = {
            color: null,
            rotation: {
              x: null,
              y: null,
              z: null
            }
          }
        }

        /**
        * Replaces any current object in the scene with the new object to display
        * @param {THREE.Mesh} object - the object the controller controls
        **/
        setObject(object) {
          if (this.objects.length == 0) { // First object
            object.geometry.center();
            object.geometry.computeBoundingSphere();
            let scale = 1/object.geometry.boundingSphere.radius;
            object.geometry.scale(scale,scale,scale);

            this.bounds = object.geometry;
          } else { // Subsequent objects
            // Not implemented yet
          }
          this.objects.push(object);
          this.container.add(object);
        }

        /**
        * Repositions the camera to view the object
        **/
        repositionCamera() {
          let y1 = -1.3 * packit.cameraDistanceFactor * this.bounds.boundingSphere.radius / (Math.tan(Math.PI * this.camera.fov / 360));
          let y2 = -1.1 * packit.cameraDistanceFactor * this.bounds.boundingSphere.radius / (this.camera.aspect * Math.tan(Math.PI * this.camera.fov / 360));
          this.camera.position.y = Math.min(y1,y2);
          this.camera.lookAt(new THREE.Vector3(0,0,0));
        }

        /**
        * Updates properties of the scene, camera, and objects
        **/
        update() {
          // Check object
          if (this.objects.length > 0) {
            // Update rotation
            if (this.target.rotation.x != null || this.target.rotation.y != null || this.target.rotation.z != null) {
              this.transitionFactors.rotation--;
              let original = new THREE.Vector3(this.container.rotation.x, this.container.rotation.y, this.container.rotation.z);
              original.lerp(new THREE.Vector3(this.target.rotation.x, this.target.rotation.y, this.target.rotation.z), 1/this.transitionFactors.rotation);
              this.container.rotation.x = original.x;
              this.container.rotation.y = original.y;
              this.container.rotation.z = original.z;
              if (this.container.rotation.x == this.target.rotation.x && this.container.rotation.y == this.target.rotation.y && this.container.rotation.z == this.target.rotation.z) {
                this.target.rotation.x = null;
                this.target.rotation.y = null;
                this.target.rotation.z = null;
              }
            } else {
              this.container.rotateX(this.rotationSpeed.x);
              this.container.rotateY(this.rotationSpeed.y);
              this.container.rotateZ(this.rotationSpeed.z);
            }
            // Update color
            for (let i=0; i<this.objects.length; i++) {
              if (this.target.color) {
                if (this.objects[i].material.color.getHex() == this.target.color.getHex()) {
                  this.target.color = null;
                } else {
                  this.transitionFactors.color--;
                  if (this.transitionFactors.color < 1) {
                    this.transitionFactors.color = 1;
                  }
                  this.objects[i].material.color.lerp(this.target.color, 1/this.transitionFactors.color);
                }
              }
            }
          }
        }

        /**
        * Sets the angular velocity for the object to rotate
        * @param {float} x - angular velocity around the x axis in degrees per frame update
        * @param {float} y - angular velocity around the y axis in degrees per frame update
        * @param {float} z - angular velocity around the z axis in degrees per frame update
        **/
        rotate(x, y, z) {
          this.rotationSpeed.x = x * Math.PI / 180;
          this.rotationSpeed.y = y * Math.PI / 180;
          this.rotationSpeed.z = z * Math.PI / 180;
        }

        /**
        * Stops any angular velocity on the object
        **/
        stopRotation() {
          this.rotationSpeed.x = 0;
          this.rotationSpeed.y = 0;
          this.rotationSpeed.z = 0;
        }

        /**
        * Rotates the object to rotation specified in a set number of frames
        * @param {float} x - final angle around the x axis in degrees
        * @param {float} x - final angle around the y axis in degrees
        * @param {float} x - final angle around the z axis in degrees
        * @param {int} transitionFrames - frames until rotation completes
        **/
        transitionRotation(x, y, z, transitionFrames) {
          this.target.rotation.x = x * Math.PI / 180;
          this.target.rotation.z = y * Math.PI / 180;
          this.target.rotation.y = z * Math.PI / 180;
          this.transitionFactors.rotation = Math.floor(transitionFrames) + 1;
        }

        /**
        * Changes the color of the object to the color specified in a set number of frames
        * @param {String} color - final color
        * @param {int} transitionFrames - frames until color change completes
        **/
        transitionColor(color, transitionFrames) {
          this.target.color = new THREE.Color(color);
          this.transitionFactors.color = Math.floor(transitionFrames) + 1;
        }
    }

    /*** CONSTANTS ***/
    /* The class name to add viewers to on document load */
    const CLASS_SPECIFIER = "packit";
    /* For each additional extension, a case must be added to the switch
    statement in packit.readFrom */
    const VALID_EXTENSIONS = ["stl", "obj"];
    /* Amount of lines parsed per batch */
    const PER_BATCH = 500;
    /* Time between batches */
    const TIMEOUT_CONSTANT = 10;
    /* Default camera distance from bounding sphere of object
    (1 would be on the bounding sphere)*/
    const CAMERA_DISTANCE_FACTOR = 1;
    /* Default color if object color is unavailable */
    const DEFAULT_COLOR = "#ef5777";
    /* Default background color */
    const DEFAULT_CLEAR_COLOR = "#000000"
    /* Default background transparency */
    const DEFAULT_TRANSPARENCY = 0;

    /*** LIBRARY VARIABLES ***/
    packit.cameraDistanceFactor = CAMERA_DISTANCE_FACTOR;
    packit.objectColor = DEFAULT_COLOR;
    packit.sceneColor = DEFAULT_CLEAR_COLOR;
    packit.transparency = DEFAULT_TRANSPARENCY;
    packit.viewers = [];

    /*** CORE LIBRARY ***/
    /**
     * When HTML DOM content is loaded, check for all properly formatted elements
     * and append scene to the element with the loaded object
     **/
    document.addEventListener("DOMContentLoaded", function() {
        let objects = document.getElementsByClassName(CLASS_SPECIFIER);
        for (let i = 0; i < objects.length; i++) {
            packit.readFrom(objects[i]);
        }
        window.addEventListener("resize", function() {
            for (let i = 0; i < packit.viewers.length; i++) {
                packit.updateViewer(packit.viewers[i]);
            }
        });
    });

    /**
     * Create a new 3d object viewer
     * @param {object} container - DOM element to put the viewer in
     **/
    packit.createViewer = function(container) {
        let viewer = new Viewer(container);
        packit.viewers.push(viewer);
        return viewer;
    }

    /**
     * Updates the orientation of a viewer (not the scene)
     * @param {Viewer} viewer - the viewer to be updated
     **/
    packit.updateViewer = function(viewer) {
        viewer.resize();
    }

    /**
     * Check the validity of the extension then make an AJAX
     * call to retrieve the object data as a string and properly parse the data
     * @param {object} container - DOM element to put the viewer in
     **/
    packit.readFrom = function(container) {
        let path = container.getAttribute("src");
        let extension = path.split(".");
        extension = extension[extension.length - 1].toLowerCase();
        // Check if file is valid
        if (VALID_EXTENSIONS.includes(extension)) {
            let viewer = packit.createViewer(container);
            // Request file
            let xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    switch (extension) {
                        case "stl":
                            packit.parseSTL(this.response, viewer);
                            break;
                        case "obj":
                            packit.parseOBJ(this.response, viewer);
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
    packit.parseSTL = function(data, viewer) {
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
                let splice = reader.result.split(/\n/g);
                let triCount = (splice.length - 3) / 7;
                if (triCount !== parseInt(triCount, 10)) {
                    throw "Illegal Parse";
                }

                let batchCount = 0;
                let batchLimit = Math.floor(triCount / PER_BATCH);
                let remainder = triCount - batchLimit * PER_BATCH;
                let triangleData = new Float32Array(triCount * 9);
                runBatch();

                /**
                 * Parses one batch of triangles from data
                 **/
                function runBatch() {
                    for (let i = 0; i < PER_BATCH; i++) {
                        getTriangle(PER_BATCH * batchCount + i);
                    }
                    batchCount++;
                    if (batchCount < batchLimit) {
                        setTimeout(runBatch(), TIMEOUT_CONSTANT);
                    } else {
                        for (let i = 0; i < remainder; i++) {
                            getTriangle(PER_BATCH * batchCount + i);
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
                let batchLimit = Math.floor(triCount / PER_BATCH);
                let remainder = triCount - batchLimit * PER_BATCH;
                let triangleData = new Float32Array(triCount * 9);
                runBatch();

                /**
                 * Parses one batch of triangles from data
                 **/
                function runBatch() {
                    for (let i = 0; i < PER_BATCH; i++) {
                        getTriangle(PER_BATCH * batchCount + i);
                    }
                    batchCount++;
                    if (batchCount < batchLimit) {
                        setTimeout(runBatch(), TIMEOUT_CONSTANT);
                    } else {
                        for (let i = 0; i < remainder; i++) {
                            getTriangle(PER_BATCH * batchCount + i);
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
    packit.parseOBJ = function(data, viewer) {
      let reader = new FileReader();

      reader.onload = function() {
        let str = reader.result;
        let splice = reader.result.split(/\n/g);
        let identifier = "";

        let materials = [];
        let vertices = [];
        let faces = [];
        let uvs = [];
        let uvfaces = [];

        for (let i=0; i<splice.length; i++) {
          identifier = splice[i].substring(0,2);

          if (identifier === "v ") {
            parseVertex(splice[i]);
          }
          else if (identifier === "vt") {
            parseUV(splice[i]);
          }
          else if (identifier === "f ") {
            parseFace(splice[i]);
          }
          /*else if (identifier === "# ") {
            console.log(splice[i]); // display obj file comments
          }*/
        }

        /****/
        function runBatch() {

        }

        viewer.display(new Float32Array(vertices), null, new Uint32Array(faces), null, new Float32Array(uvfaces));

        /**
        * parses a raw text line containing a vertex
        * @param {String} line - text line containing vertex data
        **/
        function parseVertex(line) {
          let arr = line.split(" ");
          let el;
          for (let i=0; i<arr.length; i++) {
            el = parseFloat(arr[i]);
            if (!isNaN(el)) {
              vertices.push(el);
            }
          }
        }

        /**
        * parses a raw text line containing a uv texture coordinate
        * @param {String} line - text line containing uv data
        **/
        function parseUV(line) {
          let arr = line.split(" ");
          let el;
          for (let i=0; i<arr.length; i++) {
            el = parseFloat(arr[i]);
            if (!isNaN(el)) {
              uvs.push(el);
            }
          }
        }

        /**
        * {may need fixing}
        * parses a raw text line containing a face
        * @param {String} line - text line containing polygon data
        **/
        function parseFace(line) {
          let arr = line.split(" ");
          let spl;
          let face;
          let texture
          for (let i=1; i<arr.length-1; i++) {
            spl = arr[i].split("/");
            face = parseInt(spl[0]);
            if (!isNaN(face)) {
              texture = parseInt(spl[1]);
              if (face < 0) {
                face += vertices.length/3 + 1;
              }
              faces.push(face - 1);
              if (i > 3) {
                faces.push(faces[faces.length-4]);
                faces.push(faces[faces.length-3]);
              }
              if (texture < 0) {
                texture += uvs.length/3 + 1;
              }
              uvfaces.push(texture - 1);
              if (i > 3) {
                uvfaces.push(uvfaces[uvfaces.length-4]);
                uvfaces.push(uvfaces[uvfaces.length-3]);
              }
            }
          }
        }
      }

      reader.readAsText(data);
    }

    /////////////////////////////////////////////////////////////////////////////

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, packit registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party library, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    if (typeof define === 'function' && define.amd) {
        define('packit', [], function() {
            return packit;
        });
    }
}.call(this));
