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
