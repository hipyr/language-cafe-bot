export function hasManageEventsPermission(interaction) {
  return Boolean(interaction.member?.permissions?.has('ManageEvents'));
}
