import { createServer } from "node:http";
// @ts-ignore - socket.io types resolved at runtime
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: [ "GET", "POST" ],
    credentials: true,
    allowedHeaders: [ "*" ],
  },
});

// Store for user friend data
const userFriendsStore: Record<string, {
  friends: any[];
  timestamp: number;
  online: boolean;
  socketId?: string; // Add socketId to track user's socket connection
}> = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id, "from origin:", socket.handshake.headers.origin || "unknown");

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Complete cleanup - fully remove user data on disconnect
    for (const userId in userFriendsStore) {
      if (userFriendsStore[userId]?.socketId === socket.id) {
        console.log(`Removing user data for ${userId} on disconnect`);
        delete userFriendsStore[userId];
        break;
      }
    }
  });

  socket.on("ping", () => {
    console.log("Received ping from:", socket.id);
    socket.emit("pong", { timestamp: Date.now() });
  });

  // Handle friends data updates
  socket.on("update-friends", (data) => {
    const { userId, friends, timestamp } = data;

    if (!userId || !Array.isArray(friends)) {
      console.error("Invalid friends data received:", data);
      return;
    }

    // Limit friends array size to prevent memory issues
    const limitedFriends = friends.slice(0, 1000); // Reasonable limit

    console.log(`Received friends data for user ${userId} with ${limitedFriends.length} friends`);

    // Store the friends data with the socket ID
    userFriendsStore[userId] = {
      friends: limitedFriends,
      timestamp: timestamp || Date.now(),
      online: true,
      socketId: socket.id,
    };
  });

  // Handle heartbeat messages to update user timestamp
  socket.on("heartbeat", (data) => {
    const { userId } = data;

    if (!userId) {
      console.error("Invalid heartbeat data received:", data);
      return;
    }

    // Update timestamp or create entry if it doesn't exist
    if (userFriendsStore[userId]) {
      userFriendsStore[userId].timestamp = Date.now();
      userFriendsStore[userId].online = true;
      userFriendsStore[userId].socketId = socket.id; // Update socket ID on heartbeat
    } else {
      userFriendsStore[userId] = {
        friends: [],
        timestamp: Date.now(),
        online: true,
        socketId: socket.id,
      };
    }
  });

  // Handle requests to check online status of friends
  socket.on("check-friends-status", (data) => {
    const { userId, friendIds } = data;

    if (!userId || !Array.isArray(friendIds)) {
      console.error("Invalid check-friends-status data:", data);
      return;
    }

    const result: Record<string, boolean> = {};

    // Check each friend's status
    friendIds.forEach((friendId) => {
      // Default to offline
      result[friendId] = false;

      // Check if the friend exists in the store and is online
      const friendData = userFriendsStore[friendId];

      if (friendData && friendData.friends?.length > 0) {
        // Check for mutual friendship
        const isMutualFriend = friendData.friends.some(friend =>
          friend.userId === userId || friend.boardId === userId,
        );

        // Only return true if it's a mutual friendship
        if (isMutualFriend) {
          result[friendId] = true;
        }
      }
    });

    // Send back the status results
    socket.emit("friends-status-result", { friendsStatus: result });
  });

  // Handle lobby invitations
  socket.on("send-lobby-invitation", (data) => {
    const { fromUserId, toUserId, lobbyUrl, fromName } = data;

    if (!fromUserId || !toUserId || !lobbyUrl) {
      console.error("Invalid lobby invitation data:", data);
      return;
    }

    console.log(`Received lobby invitation from ${fromUserId} to ${toUserId} for lobby: ${lobbyUrl}`);

    // Check if both users are mutual friends
    const fromUserData = userFriendsStore[fromUserId];
    const toUserData = userFriendsStore[toUserId];

    if (!fromUserData || !toUserData) {
      console.error("One or both users not found in store");
      socket.emit("lobby-invitation-error", {
        error: "One or both users not found",
        toUserId,
      });
      return;
    }

    // Check for mutual friendship
    const isFromUserFriendWithTo = fromUserData.friends.some(friend =>
      friend.userId === toUserId || friend.boardId === toUserId,
    );

    const isToUserFriendWithFrom = toUserData.friends.some(friend =>
      friend.userId === fromUserId || friend.boardId === fromUserId,
    );

    if (!isFromUserFriendWithTo || !isToUserFriendWithFrom) {
      console.error("Users are not mutual friends");
      socket.emit("lobby-invitation-error", {
        error: "Users are not mutual friends",
        toUserId,
      });
      return;
    }

    // Check if the recipient is online and has a socket connection
    if (!toUserData.online || !toUserData.socketId) {
      console.error("Recipient is offline or has no socket connection");
      socket.emit("lobby-invitation-error", {
        error: "Recipient is offline",
        toUserId,
      });
      return;
    }

    // Send the invitation to the recipient
    io.to(toUserData.socketId).emit("lobby-invitation", {
      fromUserId,
      fromName: fromName || "A friend",
      lobbyUrl,
    });

    // Confirm to the sender that the invitation was sent
    socket.emit("lobby-invitation-sent", { toUserId });
  });

  // Handle invitation responses
  socket.on("lobby-invitation-response", (data) => {
    const { fromUserId, toUserId, accepted } = data;

    if (!fromUserId || !toUserId) {
      console.error("Invalid invitation response data:", data);
      return;
    }

    // Find the sender's socket
    const fromUserData = userFriendsStore[fromUserId];
    // Find the responder's data to get their name
    const toUserData = userFriendsStore[toUserId];

    if (fromUserData && fromUserData.socketId) {
      // Get the name of the user who responded, if available
      let responderName = "Friend";
      if (toUserData && toUserData.friends) {
        // Try to find the name from their friends list
        const selfInToUserFriends = toUserData.friends.find(friend =>
          friend.userId === toUserId || friend.name,
        );
        if (selfInToUserFriends && selfInToUserFriends.name) {
          responderName = selfInToUserFriends.name;
        }
      }

      // Notify the sender about the response with more details
      io.to(fromUserData.socketId).emit("lobby-invitation-response", {
        toUserId,
        accepted,
        responderName,
        timestamp: Date.now(),
      });

      console.log(`Sent invitation response to ${fromUserId}: ${toUserId} ${accepted ? "accepted" : "declined"}`);
    } else {
      console.log(`Could not send response: sender ${fromUserId} not found or offline`);
    }
  });
});

// Check for inactive users every minute
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 3 * 60 * 1000; // 3 minutes (increased and aligned with cleanup)

  Object.keys(userFriendsStore).forEach((userId) => {
    const user = userFriendsStore[userId];
    if (user && now - user.timestamp > inactiveThreshold) {
      user.online = false;
      // Also remove if inactive for too long to align with cleanup logic
      delete userFriendsStore[userId];
    }
  });
}, 60000);

// Clean up stale records every 60 seconds (increased from 10)
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 3 * 60 * 1000; // 3 minutes (aligned with inactive threshold)

  Object.keys(userFriendsStore).forEach((userId) => {
    const user = userFriendsStore[userId];
    if (user && now - user.timestamp > staleThreshold) {
      console.log(`Removing stale record for user ${userId}`);
      delete userFriendsStore[userId];
    }
  });
}, 60000); // Increased to 60 seconds to reduce CPU load

const PORT = process.env.PORT || 4455;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
