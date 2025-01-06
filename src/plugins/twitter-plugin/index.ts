import {
  Content,
  IAgentRuntime,
  Memory,
  Plugin,
  State,
  ActionExample,
} from "@ai16z/eliza";
import { Scraper } from "agent-twitter-client";
import { SearchAction, SearchPlugin } from "../../common/types.ts";
import { createRateLimiter } from "../../common/utils.ts";

interface TwitterPluginConfig {
  username?: string;
  password?: string;
  email?: string;
  cookies?: string;
}

const isTweetUrl = (url: string): boolean => {
  const tweetRegex =
    /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  return tweetRegex.test(url);
};

const extractTweetId = (url: string): string | null => {
  const tweetRegex =
    /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  const match = url.match(tweetRegex);
  return match ? match[1] : null;
};

export class TwitterPlugin {
  readonly name: string = "twitter-parser";
  readonly description: string = "Parse and fetch details from Twitter/X URLs";
  private scraper: Scraper;
  config: TwitterPluginConfig;
  private rateLimiter = createRateLimiter(60, 60000); // 60 requests per minute

  constructor(config: TwitterPluginConfig) {
    this.config = config;
    this.scraper = new Scraper();
  }

  private async initializeScraper() {
    if (this.config.cookies) {
      await this.scraper.setCookies(JSON.parse(this.config.cookies));
    } else if (this.config.username && this.config.password) {
      await this.scraper.login(this.config.username, this.config.password);
    }
  }

  actions: SearchAction[] = [
    {
      name: "PARSE_TWEET",
      description: "Extract information from a tweet URL",
      examples: [
        [
          {
            user: "user",
            content: { text: "https://twitter.com/username/status/123456789" },
          },
        ],
      ],
      similes: ["tweet", "twitter url", "x.com"],
      validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
      ) => {
        const text =
          typeof message.content === "string"
            ? message.content
            : message.content?.text;

        return !!text && isTweetUrl(text);
      },
      handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
      ) => {
        try {
          if (!this.rateLimiter.checkLimit()) {
            return {
              success: false,
              response: "Rate limit exceeded. Please try again later.",
            };
          }

          await this.initializeScraper();

          const text =
            typeof message.content === "string"
              ? message.content
              : message.content?.text;

          const tweetId = extractTweetId(text);
          if (!tweetId) {
            return {
              success: false,
              response: "Invalid tweet URL format",
            };
          }

          const tweet = await this.scraper.getTweet(tweetId);
          if (!tweet) {
            return {
              success: false,
              response: "Tweet not found or unavailable",
            };
          }

          return {
            success: true,
            response: {
              id: tweet.id,
              text: tweet.text,
              author: tweet.username,
              timeStamp: tweet.timestamp,
              likes: tweet.likes,
              retweets: tweet.retweets,
              replies: tweet.replies,
              quotedStatus: tweet.quotedStatus,
              photos: tweet.photos,
              poll: tweet.poll,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          return {
            success: false,
            response: `Error fetching tweet: ${errorMessage}`,
          };
        }
      },
    },
  ];
}

// Example usage:
export default new TwitterPlugin({
  username: "toby_agent",
  password: "feranmijane",
  email: "adedejitobiloba7@gmail.com",
});
