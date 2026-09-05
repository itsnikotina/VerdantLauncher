const React = require('react');

let adDuration = 15;
let currentAdIndex = 0;
let ads = [ { id: 1, content: '%ad% %time=5%' }, { id: 2, content: '%ad% %time=5%' } ];
let adProgress = 0;

// Simulate the timer interval
setInterval(() => {
    const intervalMs = 50;
    const step = (intervalMs / (adDuration * 1000)) * 100;
    adProgress += step;
    
    if (adProgress >= 100) {
        currentAdIndex = (currentAdIndex + 1) % ads.length;
        adProgress = 0;
        console.log("Rotated! new index:", currentAdIndex);
        
        // Simulate the second useEffect
        const currentAd = ads[currentAdIndex];
        const match = currentAd.content.match(/%time=(\d+)%/i);
        adDuration = match ? parseInt(match[1], 10) : 15;
    }
}, 50);

console.log("Simulating...");
