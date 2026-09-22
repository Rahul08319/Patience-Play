/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The top-level namespace for the YouTube Playables SDK.
 *
 * This is a globally scoped variable in the current window. You MUST NOT
 * override this variable.
 *
 * @see https://developers.google.com/youtube/gaming/playables
 */
declare namespace ytgame {
  /**
   * The types of errors that the YouTube Playables SDK throws.
   */
  export const enum SdkErrorType {
    /**
     * The error type is unknown.
     */
    UNKNOWN = "UNKNOWN",
    /**
     * The API was temporarily unavailable.
     *
     * Ask players to retry at a later time if they are in a critical flow.
     */
    API_UNAVAILABLE = "API_UNAVAILABLE",
    /**
     * The API was called with invalid parameters.
     */
    INVALID_PARAMS = "INVALID_PARAMS",
    /**
     * The API was called with parameters exceeding the size limit.
     */
    SIZE_LIMIT_EXCEEDED = "SIZE_LIMIT_EXCEEDED",
  }

  /**
   * The error object that the YouTube Playables SDK throws.
   */
  export class SdkError extends Error {
    errorType: SdkErrorType;
  }

  /**
   * The YouTube Playables SDK version.
   */
  export const SDK_VERSION: string;

  /**
   * Whether or not the game is running within the Playables environment.
   */
  export const IN_PLAYABLES_ENV: boolean;

  /**
   * The functions and properties related to ads.
   */
  export namespace ads {
    /**
     * Requests an interstitial ad to be shown.
     *
     * Makes no guarantees about whether the ad was shown.
     * Do not use this API to reward players for watching an ad.
     */
    export function requestInterstitialAd(): Promise<void>;

    /**
     * Requests a rewarded ad to be shown for a particular reward type.
     *
     * Makes no guarantees about whether the ad was shown.
     *
     * @param rewardId Required. An identifier which uniquely identifies the claimable reward type.
     * @returns A promise that resolves on a successful request with value true if the user met
     * the conditions to receive a reward, or false if they did not.
     */
    export function requestRewardedAd(rewardId: string): Promise<boolean>;
  }

  /**
   * The functions and properties related to player engagement.
   */
  export namespace engagement {
    /**
     * The possible types of content.
     */
    export const enum ContentType {
      PLAYABLE = "PLAYABLE",
      VIDEO = "VIDEO",
    }

    /**
     * The content object the game sends to YouTube.
     */
    export interface Content {
      contentType?: ContentType | "PLAYABLE" | "VIDEO";
      id: string;
    }

    /**
     * The score object the game sends to YouTube.
     */
    export interface Score {
      value: number;
    }

    /**
     * Requests YouTube to open content corresponding to the provided content ID.
     */
    export function openYTContent(content: Content): Promise<void>;

    /**
     * Sends a score to YouTube.
     */
    export function sendScore(score: Score): Promise<void>;
  }

  /**
   * The functions and properties related to generic game behaviors.
   */
  export namespace game {
    /**
     * Notifies YouTube that the game has begun showing frames.
     * The game MUST call this API. Otherwise, the game is not shown to users.
     * firstFrameReady() MUST be called before gameReady().
     */
    export function firstFrameReady(): void;

    /**
     * Notifies YouTube that the game is ready for players to interact with.
     * The game MUST call this API when it is interactable.
     * The game MUST NOT call this API when a loading screen is still shown.
     */
    export function gameReady(): void;

    /**
     * Loads game data from YouTube in the form of a serialized string.
     */
    export function loadData(): Promise<string>;

    /**
     * Saves game data to YouTube in the form of a serialized string (max 3 MiB).
     */
    export function saveData(data: string): Promise<void>;
  }

  /**
   * The functions and properties related to the game health.
   */
  export namespace health {
    /**
     * Logs an error to YouTube.
     */
    export function logError(): void;

    /**
     * Logs a warning to YouTube.
     */
    export function logWarning(): void;
  }

  /**
   * The functions and properties related to the YouTube system.
   */
  export namespace system {
    /**
     * Returns the language that is set in the user's YouTube settings in the form of a BCP-47 language tag.
     */
    export function getLanguage(): Promise<string>;

    /**
     * Returns whether the game audio is enabled in the YouTube settings.
     */
    export function isAudioEnabled(): boolean;

    /**
     * Sets a callback to be triggered when the audio settings change event is fired from YouTube.
     */
    export function onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): () => void;

    /**
     * Sets a callback to be triggered when a pause game event is fired from YouTube.
     */
    export function onPause(callback: () => void): () => void;

    /**
     * Sets a callback to be triggered when a resume game event is fired from YouTube.
     */
    export function onResume(callback: () => void): () => void;
  }
}

declare global {
  interface Window {
    ytgame?: typeof ytgame;
  }
}

export {};
