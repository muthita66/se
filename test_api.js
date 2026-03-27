fetch('http://localhost:3000/api/teacher/teaching-evaluation?teacher_id=1&year=2568&semester=1')
  .then(res => res.json())
  .then(data => console.log("DATA:", JSON.stringify(data, null, 2)))
  .catch(err => console.error("ERR:", err));
