import {
  Plus,
  Star,
  Tag,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  addGameTag,
  getGameUserMetadata,
  removeGameTag,
  toggleGameFavorite,
} from "../services/userGameMetadata";


function TagChip({
  value,
  onRemove,
}) {
  return (
    <div
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-cyan-500/20
        bg-cyan-500/[0.07]
        py-1
        pl-2.5
        pr-1.5
        text-xs
        font-medium
        text-cyan-100/80
      "
    >
      <Tag
        className="
          h-3
          w-3
          text-cyan-300/70
        "
      />

      <span>
        {value}
      </span>

      <button
        type="button"
        onClick={
          onRemove
        }
        className="
          flex
          h-5
          w-5
          items-center
          justify-center
          rounded-full
          text-white/30
          transition
          hover:bg-white/[0.08]
          hover:text-white/70
        "
        title={
          `Remove ${value}`
        }
      >
        <X
          className="h-3 w-3"
        />
      </button>
    </div>
  );
}


export default function GamePersonalization({
  game,
}) {
  const [
    metadata,
    setMetadata,
  ] =
    useState(
      () =>
        getGameUserMetadata(
          game
        )
    );

  const [
    newTag,
    setNewTag,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState(null);


  useEffect(
    () => {
      setMetadata(
        getGameUserMetadata(
          game
        )
      );

      setNewTag(
        ""
      );

      setError(
        null
      );
    },
    [
      game?.id,
      game?.launcherId,
      game?.store,
    ]
  );


  function handleFavorite() {
    try {
      const next =
        toggleGameFavorite(
          game
        );

      setMetadata(
        next
      );
    } catch (error) {
      setError(
        String(
          error
        )
      );
    }
  }


  function handleAddTag() {
    const candidate =
      newTag
        .trim();

    if (!candidate) {
      return;
    }

    try {
      const next =
        addGameTag(
          game,
          candidate
        );

      setMetadata(
        next
      );

      setNewTag(
        ""
      );
    } catch (error) {
      setError(
        String(
          error
        )
      );
    }
  }


  function handleRemoveTag(
    tag
  ) {
    try {
      const next =
        removeGameTag(
          game,
          tag
        );

      setMetadata(
        next
      );
    } catch (error) {
      setError(
        String(
          error
        )
      );
    }
  }


  function handleKeyDown(
    event
  ) {
    if (
      event.key
      === "Enter"
    ) {
      event.preventDefault();

      handleAddTag();
    }

    if (
      event.key
      === "Escape"
    ) {
      setNewTag(
        ""
      );
    }
  }


  return (
    <div
      className="
        mt-4
        rounded-xl
        border
        border-white/[0.08]
        bg-white/[0.018]
        p-3.5
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          lg:flex-row
          lg:items-center
          lg:justify-between
        "
      >
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              handleFavorite
            }
            className={`
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              px-3
              py-2
              text-xs
              font-semibold
              transition
              ${
                metadata.favorite
                  ? "border-amber-400/30 bg-amber-400/[0.10] text-amber-200"
                  : "border-white/10 bg-white/[0.025] text-white/50 hover:bg-white/[0.06] hover:text-white/75"
              }
            `}
            title={
              metadata.favorite
                ? "Remove from favorites"
                : "Add to favorites"
            }
          >
            <Star
              className={`
                h-4
                w-4
                ${
                  metadata.favorite
                    ? "fill-current"
                    : ""
                }
              `}
            />

            {metadata.favorite
              ? "Favorited"
              : "Favorite"
            }
          </button>


          {metadata.tags.map(
            (tag) => (
              <TagChip
                key={
                  tag.toLocaleLowerCase()
                }
                value={
                  tag
                }
                onRemove={
                  () =>
                    handleRemoveTag(
                      tag
                    )
                }
              />
            )
          )}


          {metadata.tags.length
            === 0 ? (
            <span
              className="
                text-xs
                text-white/25
              "
            >
              No tags yet
            </span>
          ) : null}
        </div>


        <div
          className="
            flex
            min-w-0
            items-center
            gap-2
            lg:w-[330px]
          "
        >
          <input
            type="text"
            value={
              newTag
            }
            onChange={
              (event) =>
                setNewTag(
                  event.target.value
                )
            }
            onKeyDown={
              handleKeyDown
            }
            maxLength={
              40
            }
            placeholder="Add a tag…"
            className="
              min-w-0
              flex-1
              rounded-lg
              border
              border-white/10
              bg-black/20
              px-3
              py-2
              text-xs
              text-white/80
              outline-none
              transition
              placeholder:text-white/20
              focus:border-cyan-500/35
              focus:bg-black/25
            "
          />

          <button
            type="button"
            onClick={
              handleAddTag
            }
            disabled={
              !newTag.trim()
            }
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-lg
              border
              border-cyan-500/20
              bg-cyan-500/[0.07]
              px-2.5
              py-2
              text-xs
              font-medium
              text-cyan-200
              transition
              hover:bg-cyan-500/[0.12]
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <Plus
              className="h-3.5 w-3.5"
            />

            Add
          </button>
        </div>
      </div>


      {error ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-red-500/15
            bg-red-500/[0.05]
            px-3
            py-2
            text-xs
            text-red-300/70
          "
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
