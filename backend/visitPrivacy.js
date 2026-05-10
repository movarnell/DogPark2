function relationshipSelectFields(includeViewer = false) {
  if (!includeViewer) {
    return `u.messages_enabled, u.activity_visibility, FALSE AS is_friend`;
  }

  return `u.messages_enabled, u.activity_visibility, friend_link.id IS NOT NULL AS is_friend`;
}

function relationshipJoins(ownerExpression, includeViewer = false) {
  if (!includeViewer) return '';

  return `LEFT JOIN user_blocks blocked_by_owner
              ON blocked_by_owner.blocker_user_id = ${ownerExpression}
             AND blocked_by_owner.blocked_user_id = ?
          LEFT JOIN user_blocks blocked_owner
              ON blocked_owner.blocker_user_id = ?
             AND blocked_owner.blocked_user_id = ${ownerExpression}
          LEFT JOIN friendships friend_link
              ON friend_link.status = 'accepted'
             AND (
               (friend_link.requester_user_id = ${ownerExpression} AND friend_link.addressee_user_id = ?)
               OR (friend_link.requester_user_id = ? AND friend_link.addressee_user_id = ${ownerExpression})
             )`;
}

function relationshipJoinParams(viewerId) {
  return viewerId ? [viewerId, viewerId, viewerId, viewerId] : [];
}

function relationshipWhere(includeViewer = false) {
  if (!includeViewer) return '';
  return ' AND blocked_by_owner.blocker_user_id IS NULL AND blocked_owner.blocker_user_id IS NULL';
}

function relationshipGroupFields(includeViewer = false) {
  if (!includeViewer) return ', u.messages_enabled, u.activity_visibility';
  return ', u.messages_enabled, u.activity_visibility, friend_link.id';
}

function presentVisit(row, viewerId = '') {
  const ownerId = row.owner_user_id === undefined || row.owner_user_id === null ? '' : String(row.owner_user_id);
  const isOwn = Boolean(viewerId && ownerId && String(viewerId) === ownerId);
  const isFriend = Boolean(row.is_friend) || isOwn;
  const isSignedIn = Boolean(viewerId);
  const visibility = row.activity_visibility || 'owner_and_dog';
  const canSeeOwner = isOwn || isFriend || (isSignedIn && visibility === 'owner_and_dog');
  const canSeeDog = isOwn || isFriend || visibility !== 'anonymous';
  const canInteract = Boolean(isSignedIn && !isOwn && visibility !== 'anonymous' && row.messages_enabled !== 0);

  return {
    ...row,
    owner_user_id: canSeeOwner || isOwn ? row.owner_user_id : undefined,
    username: canSeeOwner ? row.username : '',
    full_name: canSeeOwner ? row.full_name : '',
    owner_display_name: canSeeOwner
      ? row.username || row.full_name || 'Owner'
      : canSeeDog
        ? 'Dog owner'
        : 'Anonymous owner',
    dog_id: canSeeDog ? row.dog_id : undefined,
    dog_name: canSeeDog ? row.dog_name : '',
    dog_size: canSeeDog ? row.dog_size : '',
    dog_breed: canSeeDog ? row.dog_breed : '',
    dog_avatar_url: canSeeDog ? row.dog_avatar_url : '',
    dog_energy_level: canSeeDog ? row.dog_energy_level : '',
    dog_play_style: canSeeDog ? row.dog_play_style : '',
    dog_social_comfort: canSeeDog ? row.dog_social_comfort : '',
    dog_preferred_sizes: canSeeDog ? row.dog_preferred_sizes : [],
    notes: canSeeOwner || isFriend ? row.notes : '',
    can_message: canInteract,
    can_request_friend: canInteract,
    can_block: canInteract,
    is_friend: isFriend,
    messages_enabled: undefined,
    activity_visibility: undefined,
  };
}

module.exports = {
  presentVisit,
  relationshipGroupFields,
  relationshipJoinParams,
  relationshipJoins,
  relationshipSelectFields,
  relationshipWhere,
};
