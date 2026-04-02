export function mapUser(u: any) {
  console.log(`[mapUser] === MAPPING USER START ===`);
  console.log(`[mapUser] Input user data:`, JSON.stringify(u, null, 2));
  
  const mappedUser = {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    phone: u.phone,
    city: u.city,
    role: u.role,
    points: u.points,
    trustScore: u.trust_score,
    isSuspended: u.is_suspended,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    // ❌ NEVER map password_hash to the response
    // password_hash is internal only and must never be exposed in GraphQL responses
  };

  console.log(`[mapUser] ✅ Mapped user data:`);
  console.log(`[mapUser] - id: ${mappedUser.id}`);
  console.log(`[mapUser] - email: ${mappedUser.email}`);
  console.log(`[mapUser] - city: ${mappedUser.city}`);
  console.log(`[mapUser] - points: ${mappedUser.points}`);
  console.log(`[mapUser] - trustScore: ${mappedUser.trustScore}`);
  
  return mappedUser;
}
