import {
  Star,
  UsersRound,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  clearPersonalRating,
  getPersonalRating,
  setPersonalRating,
} from "../services/personalRatings";

import {
  getSteamAppId,
  getSteamCommunityRating,
} from "../services/steamCommunityRating";

function RatingStars({
  value,
  onChange,
}) {
  const [hover, setHover] =
    useState(null);

  const active =
    hover ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map(
        (star) => (
          <button
            key={star}
            type="button"
            title={`${star} star${star === 1 ? "" : "s"}`}
            aria-label={`Rate ${star} out of 5 stars`}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(star)}
            className="
              rounded
              p-0.5
              transition
              hover:scale-110
              focus:outline-none
              focus:ring-2
              focus:ring-cyan-400/40
            "
          >
            <Star
              className={`
                h-6
                w-6
                transition
                ${
                  star <= active
                    ? "fill-amber-400 text-amber-400"
                    : "text-white/20"
                }
              `}
            />
          </button>
        )
      )}
    </div>
  );
}

export default function PersonalRatingPanel({
  game,
}) {
  const [rating, setRatingState] =
    useState(() => getPersonalRating(game));

  const [steamRating, setSteamRating] =
    useState(null);

  const [steamState, setSteamState] =
    useState("idle");

  const steamAppId =
    getSteamAppId(game);

  useEffect(
    () => {
      setRatingState(
        getPersonalRating(game)
      );
    },
    [game?.id]
  );

  useEffect(
    () => {
      let cancelled = false;

      setSteamRating(null);

      if (!steamAppId) {
        setSteamState("unavailable");
        return () => {
          cancelled = true;
        };
      }

      setSteamState("loading");

      getSteamCommunityRating(game)
        .then((result) => {
          if (cancelled) return;

          setSteamRating(result);
          setSteamState(
            result
              ? "loaded"
              : "unavailable"
          );
        })
        .catch(() => {
          if (!cancelled) {
            setSteamState("error");
          }
        });

      return () => {
        cancelled = true;
      };
    },
    [game?.id, steamAppId]
  );

  function handleRate(value) {
    setPersonalRating(game, value);
    setRatingState(value);
  }

  function handleClear() {
    clearPersonalRating(game);
    setRatingState(null);
  }

  return (
    <div
      className="
        mt-4
        flex
        flex-col
        gap-4
        rounded-xl
        border
        border-white/[0.08]
        bg-white/[0.025]
        p-4
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <div>
        <div
          className="
            text-[11px]
            font-semibold
            uppercase
            tracking-wide
            text-white/35
          "
        >
          Your Rating
        </div>

        <div
          className="
            mt-2
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          <RatingStars
            value={rating}
            onChange={handleRate}
          />

          <span
            className="
              text-sm
              font-semibold
              text-white/70
            "
          >
            {rating
              ? `${rating}/5`
              : "Not rated"}
          </span>

          {rating ? (
            <button
              type="button"
              onClick={handleClear}
              className="
                text-xs
                text-white/35
                transition
                hover:text-white/65
              "
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {steamAppId ? (
        <div
          className="
            min-w-[220px]
            rounded-lg
            border
            border-white/[0.07]
            bg-black/10
            px-4
            py-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-[11px]
              font-semibold
              uppercase
              tracking-wide
              text-white/35
            "
          >
            <UsersRound className="h-3.5 w-3.5" />
            SteamDB-style Rating
          </div>

          {steamState === "loading" ? (
            <div className="mt-1.5 text-sm text-white/40">
              Loading Steam reviews…
            </div>
          ) : null}

          {steamState === "loaded" &&
          steamRating ? (
            <>
              <div
                className="
                  mt-1.5
                  text-xl
                  font-bold
                  text-white/85
                "
              >
                {Number(
                  steamRating.rating
                ).toFixed(1)}%
              </div>

              <div className="mt-1 text-xs text-white/35">
                {Number(
                  steamRating.positive
                ).toLocaleString()} positive
                {" · "}
                {Number(
                  steamRating.total
                ).toLocaleString()} reviews
              </div>
            </>
          ) : null}

          {steamState === "error" ? (
            <div className="mt-1.5 text-xs text-amber-200/60">
              Steam review data is temporarily unavailable.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
