const jwt = require('jsonwebtoken');
const token = jwt.sign(
  {id:1, role:'admin', service:'test'}, 
  'maintenance_club_jwt_secret_change_in_production', 
  {expiresIn:'5m'}
);
console.log(token);