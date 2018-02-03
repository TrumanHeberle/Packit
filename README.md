# Packit
Easily embed 3D objects to your website
This library requires [Three.js](https://threejs.org/)

## Usage
Load [Three.js](https://threejs.org/) and Packit scripts in document head
```html
<script src="path/three.js"></script>
<script src="path/packit.js"></script>
```
Format elements in document body to have:
* src tag containing the object file path
* class called "packit"
* (optional) rotation tag containing the initial rotation of the object
* (optional) color tag containing the initial color of the object

Example:
```html
<!-- Replace path/foo.stl with your file path -->
<div src="path/foo.stl" class="packit"></div>
<!-- Element with style (below) -->
<div src="path/foo.stl" class="packit" style="width: 300px; height: 300px;"></div>
<!-- Element with rotation specified (below) -->
<div src="path/foo.stl" rotation="0,1,0" class="packit" style="width: 300px; height: 300px;"></div>
<!-- Element with color specified (below) -->
<div src="path/foo.stl" color="blue" class="packit" style="width: 300px; height: 300px;"></div>
```

## Javascript Functions
#### Viewers
Each HTML Packit element will automatically be formatted by the library and a Viewer object will be created for it. The Packit library stores an array of Viewer objects for every object created. Note that this process is **asynchronous** and you must use the window onload event to properly interact with the Viewers.
```javascript
// log all viewers created automatically
window.onload = function() {
  console.log(packit.viewers);
}
````
#### Methods
rotate(x, y, z):
* rotates the object around its axis by fixed amounts per frame update (continuously)
````javascript
/*  rotates 1 degrees per frame around the x axis
    rotates 2 degrees per frame around the y axis
    rotates 3 degrees per frame around the z axis */
viewer.rotate(1, 2, 3);
````
stopRotation():
* stops any continuous rotation
````javascript
/*  stop the object's rotation */
viewer.stopRotation();
````
setRotation(x, y, z):
* rotates the object around its axis to fixed amounts (immidiately)
````javascript
/*  rotate to 25 degrees around the x axis
    rotate to 190 degrees around the y axis
    rotate to -85 degrees around the z axis */
viewer.setRotation(25, 190, -85);
````
transitionRotation(x, y, z, frames):
* rotates the object around its axis to fixed amounts over a certain amount of frames
````javascript
/*  rotates to 25 degrees around the x axis over 50 frames
    rotates to 190 degrees around the y axis over 50 frames
    rotates to -85 degrees around the z axis over 50 frames */
viewer.transitionRotation(25, 190, -85, 50);
````
setColor(color):
* sets the color of the object (immidiately)
````javascript
// set the object color to blue
viewer.setColor("blue");
````
transitionColor(color, frames):
* sets the color of the object over a certain amount of frames
````javascript
// set the object color to blue over 50 frames
viewer.transitionColor("blue", 50);
````
