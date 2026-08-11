import type { IGameData } from "@/utils/game-data-storage";

import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

let gameDataWatcherUnwatch: any;

export async function discordStream() {
  console.log("Autodarts Tools: Discord Stream - Starting");

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch((_gameData: IGameData, _oldGameData: IGameData) => {
    if ( 
      _gameData.match?.player !== _oldGameData.match?.player
      || _gameData.match?.turns[0].throws.length !== _oldGameData.match?.turns[0].throws.length
      || _gameData.match?.gameScores.length !== _oldGameData.match?.gameScores.length
    ) {
      console.log("Autodarts Tools: Discord Stream - Game data changed, sending webhook");
      if (_gameData.match?.variant !== "Bull-off") sendWebhook();
    }
  });
}

export function discordStreamOnRemove() {
  if (gameDataWatcherUnwatch) {
    gameDataWatcherUnwatch();
    gameDataWatcherUnwatch = null;
  }
}

async function sendWebhook() {
  try {
    const config = await AutodartsToolsConfig.getValue();
    const gameData = await AutodartsToolsGameData.getValue();

    // Create gameDataEmbedFields from match data
    const gameDataEmbedFields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (gameData?.match?.players.length) {
      // Check if there's a winner
      if (gameData.match.gameWinner !== undefined && gameData.match.gameWinner >= 0) {
        // Show the winner and remove scores
        const winnerName = gameData.match.players[gameData.match.gameWinner].name;
        gameDataEmbedFields.push({
          name: "🏆 WINNER",
          value: `\`${winnerName.toUpperCase()}\``,
          inline: false,
        });
      } else {
        // Show normal player scores like before
        const activePlayerName = gameData.match.players[gameData.match?.player].name;
        gameData.match.players.forEach((player, index) => {
          const isActive = player.name === activePlayerName;
          const icon = isActive ? "🎯" : "⚫";

          gameDataEmbedFields.push({
            name: player.name.toUpperCase(),
            value: `${icon} \`${gameData.match?.gameScores?.[index] || "-"}\``,
            inline: true,
          });
        });

        // Fill remaining spots with empty fields if needed
        const remainingFields = 3 - (gameDataEmbedFields.length % 3);
        if (remainingFields < 3) {
          for (let i = 0; i < remainingFields; i++) {
            gameDataEmbedFields.push({
              name: "\u200B",
              value: "\u200B",
              inline: true,
            });
          }
        }

        gameDataEmbedFields.push({
          name: "\u200B",
          value: `\`${gameData.match?.turnBusted ? "Busted" : gameData.match?.turnScore}\``,
          inline: false,
        });

        gameDataEmbedFields.push({
          name: "\u200B",
          value: `\`${gameData.match.turns[0].throws?.[0]?.segment?.name || "-"}\``,
          inline: true,
        });

        gameDataEmbedFields.push({
          name: "\u200B",
          value: `\`${gameData.match.turns[0].throws?.[1]?.segment?.name || "-"}\``,
          inline: true,
        });

        gameDataEmbedFields.push({
          name: "\u200B",
          value: `\`${gameData.match.turns[0].throws?.[2]?.segment?.name || "-"}\``,
          inline: true,
        });
      }
    }

    const response = await fetch(
      config.discord.autoStartAfterTimer?.messageId.includes("https")
        ? `${config.discord.url}?wait=true`
        : `${config.discord.url}/messages/${config.discord.autoStartAfterTimer?.messageId}`, {
        method: config.discord.autoStartAfterTimer?.messageId.includes("https") ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              color: 8902706,
              fields: gameDataEmbedFields,
              image: {
                url: "https://i.imgur.com/lnkebyw.png",
              },
            },
          ],
          username: "Autodarts Tools",
          avatar_url: "https://lh3.googleusercontent.com/YwAEtrxsMxCS_nQpaTE96s4lBqmcGAI1MyI88-4E1vXK4EFoe3kTInegjd-7P2bRsWFPN1bRW5dVKBTcX8oQbeEg",
          attachments: [],
        }),
      });

    const messageData = await response.json();
    const messageId = messageData.id;

    console.log("Autodarts Tools: Discord Stream - Message ID:", messageId);

    // Store current URL in config if stream is enabled
    if (config.discord.autoStartAfterTimer?.stream) {
      await AutodartsToolsConfig.setValue({
        ...config,
        discord: {
          ...config.discord,
          autoStartAfterTimer: {
            ...config.discord.autoStartAfterTimer,
            messageId: gameData.match?.gameWinner !== undefined && gameData.match?.gameWinner >= 0
              ? window.location.href
              : messageId,
          },
        },
      });
    }

    return messageId;
  } catch (e) {
    console.error("Autodarts Tools: Discord Stream - Error sending discord stream: ", e);
    return null;
  }
}
