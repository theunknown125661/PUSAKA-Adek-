const http = require('http');
http.get('http://localhost:3000/student/check-in', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const hasLeafletCSS = data.includes('leaflet.css') || data.includes('leaflet');
    console.log('Page length:', data.length);
    console.log('Has leaflet reference:', hasLeafletCSS);
    
    // Check for CSS link tags
    const linkTags = data.match(/<link[^>]*>/g) || [];
    linkTags.forEach(tag => {
      if (tag.includes('leaflet') || tag.includes('css')) {
        console.log('CSS link:', tag.substring(0, 200));
      }
    });
  });
});
