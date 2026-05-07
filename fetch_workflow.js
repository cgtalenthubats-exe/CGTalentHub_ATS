const https = require('https');

const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MTlhZTY4Ny00ZDZhLTQwMjgtYTVjZi03MmM1MzI4ZTMwNWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMWUwOGI3NjAtOWQzZi00OGJmLWFhMDUtMDQzM2IwNDNiMzFkIiwiaWF0IjoxNzc4MTM2ODM0fQ.H9zXHsgtVlvBQUmkuiB6Ay4G7l9URXB2a0WgldiqBZM";
const workflowId = "stTCIZ5bhAzS3hME";
const url = `https://n8n.srv1212906.hstgr.cloud/api/v1/workflows/${workflowId}`;

const options = {
  headers: {
    'X-N8N-API-KEY': apiKey
  }
};

https.get(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const wf = JSON.parse(data);
        console.log(`Workflow Name: ${wf.name}`);
        console.log(`Status: ${wf.active ? 'Active' : 'Inactive'}`);
        console.log(`\nNodes (${wf.nodes.length}):`);
        wf.nodes.forEach(n => {
          console.log(`- [${n.type}] ${n.name}`);
        });
      } catch (e) {
        console.error("Error parsing JSON:", e);
      }
    } else {
      console.log(`Error ${res.statusCode}: ${data}`);
    }
  });
}).on('error', (err) => {
  console.log('Request Error: ', err.message);
});
