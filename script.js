let map;
let markers = [];
let times = [];
let directionsService;
let directionsRenderer;
let geocoder;
let locs;
let count = 0;

class Node {
    constructor(path, cost) {
        this.path = path;
        this.cost = cost;
    }
    getPath() { return this.path;}
    getCost() { return this.cost;}
}

class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    getLeftChildIndex(parentIndex) { return 2 * parentIndex + 1;}
 
    getRightChildIndex(parentIndex) { return 2 * parentIndex + 2;}
 
    getParentIndex(childIndex) { return Math.floor((childIndex - 1) / 2);}
 
    hasLeftChild(index) { return this.getLeftChildIndex(index) < this.heap.length;}
 
    hasRightChild(index) { return this.getRightChildIndex(index) < this.heap.length;}
 
    hasParent(index) { return this.getParentIndex(index) >= 0;}
 
    leftChild(index) { return this.heap[this.getLeftChildIndex(index)];}
 
    rightChild(index) { return this.heap[this.getRightChildIndex(index)];}
 
    parent(index) { return this.heap[this.getParentIndex(index)];}
 
    swap(indexOne, indexTwo) {
        const temp = this.heap[indexOne];
        this.heap[indexOne] = this.heap[indexTwo];
        this.heap[indexTwo] = temp;
    }
 
    peek() {
        if (this.heap.length === 0) { return null;}
        return this.heap[0];
    }
 
    remove() {
        if (this.heap.length === 0) { return null;}
        const item = this.heap[0];
        this.heap[0] = this.heap[this.heap.length - 1];
        this.heap.pop();
        this.heapifyDown();
        return item;
    }
 
    add(item) {
        this.heap.push(item);
        this.heapifyUp();
    }
 
    heapifyUp() {
        let index = this.heap.length - 1;
        while (this.hasParent(index) && this.parent(index).getCost() > this.heap[index].getCost()) {
            this.swap(this.getParentIndex(index), index);
            index = this.getParentIndex(index);
        }
    }
 
    heapifyDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.rightChild(index).getCost() < this.leftChild(index).getCost()) {
                smallerChildIndex = this.getRightChildIndex(index);
            }
            if (this.heap[index].getCost() < this.heap[smallerChildIndex].getCost()) {
                break;
            } else {
                this.swap(index, smallerChildIndex);
            }
            index = smallerChildIndex;
        }
    }
}

function initMap() {
    // Initialize the Directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    geocoder = new google.maps.Geocoder();

    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 0, lng: 0},
        zoom:14
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Create a map centered on the user's location
            map = new google.maps.Map(document.getElementById('map'), {
                center: pos,
                zoom: 14
            });

            // Add a marker at the user's location
            const marker = new google.maps.Marker({
                position: pos,
                map: map,
                title: 'You are here!'
            });

            // Listen for clicks on the map to add markers
            map.addListener('click', (event) => {
                addMarker(event.latLng);
            });

            // Bind the DirectionsRenderer to the map
            directionsRenderer.setMap(map);
        }, () => {
            handleLocationError(true, map.getCenter());
        });
    } else {
        handleLocationError(false, map.getCenter());
    }

    document.getElementById('clearMarkers').addEventListener('click', clearMarkers);
    document.getElementById('searchButton').addEventListener('click', searchLocation);
    document.getElementById('calcPaths').addEventListener('click', calculateAndDisplayRoute);
}

function addMarker(location) {
    let marker = new google.maps.Marker({
        position: location,
        map: map
    });
    markers.push(marker);

    geocodeLocation(location);
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    count = 0;
    directionsRenderer.set('directions', null);
    document.getElementById('travelTime').innerHTML = ''; // Clear the info div
    document.getElementById('markerLegend').innerHTML = ''; // Clear the marker legend
}

async function calculateAndDisplayRoute() {
    locs = markers.map(marker => marker.getPosition());
    times = [];
    let temp;
    for (let i=0; i < locs.length; i++) {
        temp = [];
        for (let j=0; j < locs.length; j++) {
            if (i != j) {
                await reqTime(locs[i], locs[j]).then(result => temp.push(result));
            } else {
                temp.push(0);
            }
        }
        times.push(temp);
    }
    // PQ. Uniform Cost with special rules and termination
    let queue = new PriorityQueue();
    queue.add(createNode([0], 0));
    const route = shortestPath(queue);
    // document.getElementById('travelTime').innerHTML = "Times: " + tmp;
    // console.log(route);
}

function createNode(path, cost) {
    const node = new Node(path, cost);
    return node;
}

function shortestPath(queue) {
    const pnode = queue.remove();
    displayRoute(pnode);
    console.log(pnode);
    if (pnode.getPath().length === times.length+1) return;
    if (pnode.getPath().length === times.length) {
        let pth = [...pnode.getPath()];
        pth.push(0);
        queue.add(createNode(pth, times[pnode.getPath()[pnode.getPath().length-1]][0] + pnode.getCost()));
        setTimeout(() => shortestPath(queue), 200);
        return;
    }
    for (let i=1; i < times.length; i++) {
        if (!pnode.getPath().includes(i)) {
            let pth = [...pnode.getPath()];
            pth.push(i);
            queue.add(createNode(pth, times[pnode.getPath()[pnode.getPath().length-1]][i] + pnode.getCost()));
        }
    }
    setTimeout(() => shortestPath(queue), 200);
}

function displayRoute(pnode) {
    let rt = pnode.getPath();
    if (rt.length < 2) return;
    let waypts = [];
    for (let i=1; i < rt.length-1; i++) {
        waypts.push({location: locs[rt[i]], stopover: true});
    }
    directionsService.route({
        origin: locs[rt[0]],
        destination: locs[rt[rt.length-1]],
        waypoints: waypts,
        travelMode: 'DRIVING'
    }, (response, status) => {
        if (status == 'OK') { directionsRenderer.setDirections(response);}
        else {window.alert('Directions request failed due to ' + status);}
    });
}

function reqTime(loc1, loc2) {
    return new Promise((resolve, reject) => {
        directionsService.route(
            {
                origin: loc1,
                destination: loc2,
                travelMode: 'DRIVING'
            }, (response, status) => {
                if (status == 'OK') {
                    //journey time in seconds
                    resolve(response.routes[0].legs[0].duration.value);
                } else {
                    reject(0);
                }
            });
    });
}

function searchLocation() {
    const address = document.getElementById('searchInput').value;
    geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK') {
            const location = results[0].geometry.location;
            map.setCenter(location);
            addMarker(location);
        } else {
            alert('Geocode was not successful for the following reason: ' + status);
        }
    });
}

function geocodeLocation(location) {
    geocoder.geocode({ location: location }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                const address = results[0].formatted_address;
                updateMarkerLegend(address);
            } else {
                alert('No results found');
            }
        } else {
            alert('Geocoder failed due to: ' + status);
        }
    });
}

function updateMarkerLegend(address) {
    const markerLegend = document.getElementById('markerLegend');
    const newAddress = document.createElement('div');
    count++;
    newAddress.textContent = "Marker " + count + ": " + address;
    markerLegend.appendChild(newAddress);
}

function handleLocationError(browserHasGeolocation, pos) {
    alert(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.');
}