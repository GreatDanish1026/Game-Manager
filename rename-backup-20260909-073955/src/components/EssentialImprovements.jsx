import {
  useMemo,
} from "react";

import {
  ExternalLink,
  Wrench,
} from "lucide-react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import DOMPurify from "dompurify";


const PCGW_BASE_URL =
  "https://www.pcgamingwiki.com";


function cleanPcgwHtml(
  rawHtml
) {
  if (!rawHtml) {
    return "";
  }

  /*
   * Sanitize everything received from the remote
   * MediaWiki server before putting it in our WebView.
   */
  const sanitized =
    DOMPurify.sanitize(
      rawHtml,
      {
        USE_PROFILES: {
          html: true,
        },
      }
    );


  /*
   * After sanitization we can remove PCGW-specific
   * presentation elements that don't make sense
   * inside Game Manager.
   */
  const parser =
    new DOMParser();

  const document =
    parser.parseFromString(
      sanitized,
      "text/html"
    );


  /*
   * Remove edit-section buttons.
   */
  document
    .querySelectorAll(
      ".mw-editsection"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );


  /*
   * Remove citation backlink markers. The actual
   * information remains in the text.
   */
  document
    .querySelectorAll(
      ".mw-cite-backlink"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );


  /*
   * MediaWiki usually includes the section's H2.
   * Game Manager already supplies its own
   * "Essential Improvements" heading, so remove
   * the duplicate.
   */
  const essentialHeading =
    document.querySelector(
      "#Essential_improvements"
    );

  if (essentialHeading) {
    const headingWrapper =
      essentialHeading.closest(
        ".mw-heading"
      );

    if (headingWrapper) {
      headingWrapper.remove();
    } else {
      essentialHeading.remove();
    }
  }


  /*
   * Remove empty elements MediaWiki adds for layout.
   */
  document
    .querySelectorAll(
      ".mw-empty-elt"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );


  /*
   * External images are unnecessary here and could
   * generate extra network requests inside the app.
   */
  document
    .querySelectorAll(
      "img"
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );


  return document.body.innerHTML;
}


function resolvePcgwUrl(
  href,
  pageUrl
) {
  if (!href) {
    return null;
  }

  const value =
    href.trim();

  if (!value) {
    return null;
  }


  /*
   * Normal absolute web URL.
   */
  if (
    value.startsWith(
      "https://"
    ) ||
    value.startsWith(
      "http://"
    )
  ) {
    return value;
  }


  /*
   * Protocol-relative URL.
   */
  if (
    value.startsWith("//")
  ) {
    return `https:${value}`;
  }


  /*
   * PCGamingWiki-relative URL.
   */
  if (
    value.startsWith("/")
  ) {
    return (
      `${PCGW_BASE_URL}${value}`
    );
  }


  /*
   * Anchor within the current PCGW article.
   */
  if (
    value.startsWith("#") &&
    pageUrl
  ) {
    return (
      `${pageUrl}${value}`
    );
  }


  /*
   * Other relative URLs.
   */
  try {
    return new URL(
      value,
      PCGW_BASE_URL
    ).toString();
  } catch {
    return null;
  }
}


export default function EssentialImprovements({
  game,
}) {
  const rawHtml =
    game
      ?.essentialImprovementsHtml;


  const html =
    useMemo(
      () =>
        cleanPcgwHtml(
          rawHtml
        ),
      [
        rawHtml,
      ]
    );


  async function handleContentClick(
    event
  ) {
    const anchor =
      event.target.closest(
        "a"
      );

    if (!anchor) {
      return;
    }

    event.preventDefault();


    const href =
      anchor.getAttribute(
        "href"
      );

    const url =
      resolvePcgwUrl(
        href,
        game?.pcgwPageUrl
      );

    if (!url) {
      return;
    }


    try {
      console.log(
        "[Essential Improvements] Opening:",
        url
      );

      await openUrl(
        url
      );
    } catch (error) {
      console.error(
        "[Essential Improvements] Failed to open link:",
        error
      );
    }
  }


  async function handleOpenPcgw() {
    if (!game?.pcgwPageUrl) {
      return;
    }

    try {
      await openUrl(
        `${game.pcgwPageUrl}#Essential_improvements`
      );
    } catch (error) {
      console.error(
        "[Essential Improvements] Failed to open PCGW:",
        error
      );
    }
  }


  /*
   * While PCGW itself is loading, don't show a
   * misleading "nothing found" message.
   */
  if (
    game?.pcgwLoading
  ) {
    return (
      <section
        className="
          mb-10
        "
      >
        <div
          className="
            mb-6
          "
        >
          <h2
            className="
              text-2xl
              font-semibold
              text-white
            "
          >
            Essential Improvements
          </h2>

          <p
            className="
              mt-2
              text-sm
              text-white/40
            "
          >
            Loading recommended patches,
            fixes, utilities, and major
            community improvements from
            PCGamingWiki.
          </p>
        </div>

        <div
          className="
            rounded-xl
            border
            border-white/10
            bg-white/[0.025]
            p-5
            text-sm
            text-white/40
          "
        >
          Loading Essential Improvements...
        </div>
      </section>
    );
  }


  /*
   * Not every PCGW game page has an Essential
   * improvements section.
   */
  if (!html) {
    return (
      <section
        className="
          mb-10
        "
      >
        <div
          className="
            mb-6
          "
        >
          <h2
            className="
              text-2xl
              font-semibold
              text-white
            "
          >
            Essential Improvements
          </h2>

          <p
            className="
              mt-2
              text-sm
              text-white/40
            "
          >
            Important patches, fixes,
            utilities, and community
            improvements recommended by
            PCGamingWiki.
          </p>
        </div>

        <div
          className="
            flex
            items-center
            gap-4
            rounded-xl
            border
            border-white/10
            bg-white/[0.025]
            p-5
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-white/[0.05]
              text-white/35
            "
          >
            <Wrench
              className="h-5 w-5"
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-medium
                text-white/65
              "
            >
              No essential improvements listed
            </div>

            <div
              className="
                mt-1
                text-xs
                text-white/35
              "
            >
              PCGamingWiki does not currently
              list an Essential Improvements
              section for this game.
            </div>
          </div>
        </div>
      </section>
    );
  }


  return (
    <section
      className="
        mb-10
      "
    >
      <div
        className="
          mb-6
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-end
          lg:justify-between
        "
      >
        <div>
          <h2
            className="
              text-2xl
              font-semibold
              text-white
            "
          >
            Essential Improvements
          </h2>

          <p
            className="
              mt-2
              text-sm
              leading-relaxed
              text-white/40
            "
          >
            Important patches, fixes,
            utilities, and major community
            improvements recommended by
            PCGamingWiki.
          </p>
        </div>

        {game?.pcgwPageUrl ? (
          <button
            type="button"
            onClick={
              handleOpenPcgw
            }
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              rounded-lg
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-2
              text-sm
              font-medium
              text-white/65
              transition
              hover:border-white/20
              hover:bg-white/[0.08]
              hover:text-white
            "
          >
            <ExternalLink
              className="h-4 w-4"
            />

            View on PCGamingWiki
          </button>
        ) : null}
      </div>


      <div
        className="
          rounded-xl
          border
          border-white/10
          bg-white/[0.025]
          p-5
          lg:p-6
        "
      >
        <div
          onClick={
            handleContentClick
          }
          className="
            text-sm
            leading-7
            text-white/70

            [&_a]:cursor-pointer
            [&_a]:font-medium
            [&_a]:text-cyan-300
            [&_a]:underline
            [&_a]:decoration-cyan-400/30
            [&_a]:underline-offset-2
            [&_a:hover]:text-cyan-200

            [&_h3]:mb-3
            [&_h3]:mt-7
            [&_h3]:text-lg
            [&_h3]:font-semibold
            [&_h3]:text-white
            [&_h3:first-child]:mt-0

            [&_h4]:mb-2
            [&_h4]:mt-6
            [&_h4]:text-base
            [&_h4]:font-semibold
            [&_h4]:text-white/90

            [&_h5]:mb-2
            [&_h5]:mt-5
            [&_h5]:font-semibold
            [&_h5]:text-white/80

            [&_p]:my-3

            [&_ul]:my-3
            [&_ul]:list-disc
            [&_ul]:space-y-1
            [&_ul]:pl-6

            [&_ol]:my-3
            [&_ol]:list-decimal
            [&_ol]:space-y-1.5
            [&_ol]:pl-6

            [&_li]:pl-1

            [&_b]:font-semibold
            [&_b]:text-white/90

            [&_strong]:font-semibold
            [&_strong]:text-white/90

            [&_code]:rounded
            [&_code]:border
            [&_code]:border-white/10
            [&_code]:bg-black/30
            [&_code]:px-1.5
            [&_code]:py-0.5
            [&_code]:font-mono
            [&_code]:text-xs
            [&_code]:text-cyan-200

            [&_pre]:my-4
            [&_pre]:overflow-x-auto
            [&_pre]:rounded-lg
            [&_pre]:border
            [&_pre]:border-white/10
            [&_pre]:bg-black/30
            [&_pre]:p-4

            [&_table]:my-5
            [&_table]:w-full
            [&_table]:border-collapse
            [&_table]:overflow-hidden
            [&_table]:rounded-lg

            [&_th]:border
            [&_th]:border-white/10
            [&_th]:bg-white/[0.05]
            [&_th]:px-3
            [&_th]:py-2
            [&_th]:text-left
            [&_th]:text-xs
            [&_th]:font-semibold
            [&_th]:text-white/70

            [&_td]:border
            [&_td]:border-white/10
            [&_td]:px-3
            [&_td]:py-2
            [&_td]:align-top

            [&_hr]:my-5
            [&_hr]:border-white/10

            [&_blockquote]:my-4
            [&_blockquote]:border-l-2
            [&_blockquote]:border-cyan-500/40
            [&_blockquote]:pl-4
            [&_blockquote]:text-white/55

            [&_.notice]:my-4
            [&_.notice]:rounded-lg
            [&_.notice]:border
            [&_.notice]:border-white/10
            [&_.notice]:bg-white/[0.03]
            [&_.notice]:p-4
          "
          dangerouslySetInnerHTML={{
            __html: html,
          }}
        />
      </div>


      <div
        className="
          mt-3
          text-right
          text-[11px]
          text-white/25
        "
      >
        Content provided by PCGamingWiki
      </div>
    </section>
  );
}