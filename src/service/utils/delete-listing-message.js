export default async (client, listing) => {
  if (!listing?.listingChannelId || !listing?.listingMessageId) return;

  try {
    const channel = await client.channels.fetch(listing.listingChannelId);
    await channel.messages.delete(listing.listingMessageId);
  } catch (error) {
    if (error?.code !== 10003 && error?.code !== 10008) {
      console.error('Failed to delete listing message:', error);
    }
  }
};
