import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Test endpoint to verify image generation is working
 * Visit: http://localhost:3000/api/test-image
 * 
 * This will return a simple test image to verify the image pipeline is working.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Generate a simple test SVG
  const width = 512;
  const height = 512;
  const seed = Date.now();
  
  // Create gradient colors based on time
  const hue1 = (seed / 1000) % 360;
  const hue2 = (hue1 + 60) % 360;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="testGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1}, 70%, 40%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue2}, 60%, 30%)"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:hsl(${hue1}, 80%, 60%);stop-opacity:0.5"/>
        <stop offset="100%" style="stop-color:transparent"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#testGrad)"/>
    <circle cx="256" cy="256" r="150" fill="url(#glow)"/>
    <circle cx="256" cy="256" r="80" fill="hsl(${hue1}, 70%, 50%)" opacity="0.8"/>
    <text x="50%" y="90%" text-anchor="middle" fill="white" font-family="system-ui" font-size="16">Test Image - ${new Date().toISOString().slice(11, 19)}</text>
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  // Return as JSON (like the generate endpoint)
  if (req.query.format === 'json') {
    return res.status(200).json({
      success: true,
      dataUrl,
      seed,
      message: 'Test image generated successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // Return as HTML page for visual testing
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Image Generation Test</title>
      <style>
        body { 
          background: #0a0a0b; 
          color: white; 
          font-family: system-ui; 
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .test-image { 
          border: 2px solid #00d4aa; 
          border-radius: 8px;
          margin: 20px 0;
        }
        .info { 
          background: #1a1a24; 
          padding: 15px; 
          border-radius: 8px; 
          max-width: 600px;
          width: 100%;
        }
        pre { 
          background: #121215; 
          padding: 10px; 
          border-radius: 4px; 
          overflow-x: auto;
          font-size: 12px;
        }
        .success { color: #00d4aa; }
        h1 { color: #00d4aa; }
      </style>
    </head>
    <body>
      <h1>✅ Image Generation Test</h1>
      <p class="success">If you can see the image below, image rendering is working!</p>
      
      <img src="${dataUrl}" class="test-image" width="512" height="512" alt="Test Image" />
      
      <div class="info">
        <h3>Debug Information:</h3>
        <p><strong>Data URL Length:</strong> ${dataUrl.length} characters</p>
        <p><strong>Data URL Type:</strong> ${dataUrl.slice(0, 30)}...</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Seed:</strong> ${seed}</p>
        
        <h3>Data URL Preview (first 200 chars):</h3>
        <pre>${dataUrl.slice(0, 200)}...</pre>
        
        <h3>Test JSON Response:</h3>
        <p>Visit <a href="/api/test-image?format=json" style="color:#00d4aa">/api/test-image?format=json</a> for JSON response</p>
      </div>
    </body>
    </html>
  `);
}
