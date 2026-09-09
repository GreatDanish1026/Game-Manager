import {
  Check,
  CircleHelp,
  Gamepad2,
  Radio,
  X,
  Zap,
} from "lucide-react";


function normalizeDisplayValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  if (
    typeof value === "boolean"
  ) {
    return value
      ? {
          label: "Supported",
          state: "supported",
        }
      : {
          label: "Not Supported",
          state: "unsupported",
        };
  }

  const text =
    String(value).trim();

  if (!text) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  const normalized =
    text.toLowerCase();

  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "supported" ||
    normalized === "native"
  ) {
    return {
      label: "Supported",
      state: "supported",
    };
  }

  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "none" ||
    normalized === "unsupported"
  ) {
    return {
      label: "Not Supported",
      state: "unsupported",
    };
  }

  if (
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "na"
  ) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  return {
    label:
      formatControllerText(text),
    state: "custom",
  };
}


function formatControllerText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Unknown";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "Unknown";
  }

  const specialCases = {
    usb: "USB",
    xinput: "XInput",
    xbox: "Xbox",
    playstation: "PlayStation",
    dualshock: "DualShock",
    dualsense: "DualSense",
    bluetooth: "Bluetooth",
    nintendo: "Nintendo",
    switch: "Switch",
    pro: "Pro",
    joycon: "Joy-Con",
    "joy-con": "Joy-Con",
    gamepad: "Gamepad",
  };

  return text
    .split(/(\s+|,\s*|\/)/)
    .map((part) => {
      /*
       * Preserve separators and whitespace.
       */
      if (
        /^\s+$/.test(part) ||
        /^,\s*$/.test(part) ||
        part === "/"
      ) {
        return part;
      }

      const normalized =
        part.toLowerCase();

      if (
        specialCases[normalized]
      ) {
        return specialCases[
          normalized
        ];
      }

      /*
       * Preserve numeric values such as:
       *
       * 4
       * 5
       */
      if (/^\d+$/.test(part)) {
        return part;
      }

      /*
       * Preserve strings which already contain
       * useful mixed capitalization.
       */
      if (
        /[a-z][A-Z]/.test(part)
      ) {
        return part;
      }

      return (
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase()
      );
    })
    .join("");
}


function SupportBadge({
  value,
}) {
  const status =
    normalizeDisplayValue(
      value
    );

  if (
    status.state === "supported"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          border-emerald-500/30
          bg-emerald-500/10
          px-3
          py-1.5
          text-sm
          font-semibold
          text-emerald-300
        "
      >
        <Check
          className="h-4 w-4"
        />

        <span>
          {status.label}
        </span>
      </div>
    );
  }

  if (
    status.state === "unsupported"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          border-red-500/30
          bg-red-500/10
          px-3
          py-1.5
          text-sm
          font-semibold
          text-red-300
        "
      >
        <X
          className="h-4 w-4"
        />

        <span>
          {status.label}
        </span>
      </div>
    );
  }

  if (
    status.state === "custom"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          border-amber-500/30
          bg-amber-500/10
          px-3
          py-1.5
          text-sm
          font-semibold
          text-amber-300
        "
      >
        <CircleHelp
          className="h-4 w-4"
        />

        <span>
          {status.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className="
        inline-flex
        items-center
        gap-2
        rounded-full
        border
        border-white/10
        bg-white/[0.04]
        px-3
        py-1.5
        text-sm
        font-semibold
        text-white/45
      "
    >
      <CircleHelp
        className="h-4 w-4"
      />

      <span>
        Unknown
      </span>
    </div>
  );
}


function DetailRow({
  label,
  value,
  supportValue = false,
}) {
  return (
    <div
      className="
        flex
        min-h-[56px]
        items-center
        justify-between
        gap-4
        border-t
        border-white/[0.06]
        py-3
        first:border-t-0
      "
    >
      <div
        className="
          shrink-0
          text-sm
          text-white/45
        "
      >
        {label}
      </div>

      <div
        className="
          max-w-[65%]
          text-right
        "
      >
        {supportValue ? (
          <SupportBadge
            value={value}
          />
        ) : (
          <span
            className="
              text-sm
              leading-relaxed
              text-white/85
            "
          >
            {formatControllerText(
              value
            )}
          </span>
        )}
      </div>
    </div>
  );
}


function ControllerCard({
  title,
  subtitle,
  children,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
        p-5
      "
    >
      <div
        className="
          mb-5
          flex
          items-start
          gap-4
        "
      >
        <div
          className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-cyan-500/10
            text-cyan-400
          "
        >
          <Gamepad2
            className="h-6 w-6"
          />
        </div>

        <div>
          <h3
            className="
              text-base
              font-semibold
              text-white
            "
          >
            {title}
          </h3>

          <p
            className="
              mt-1
              text-sm
              text-white/40
            "
          >
            {subtitle}
          </p>
        </div>
      </div>

      <div>
        {children}
      </div>
    </div>
  );
}


function DualSenseFeature({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-4
        rounded-lg
        border
        border-white/[0.07]
        bg-white/[0.025]
        px-4
        py-3
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <div
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            bg-white/[0.05]
            text-white/70
          "
        >
          <Icon
            className="h-4 w-4"
          />
        </div>

        <span
          className="
            text-sm
            font-medium
            text-white/80
          "
        >
          {label}
        </span>
      </div>

      <SupportBadge
        value={value}
      />
    </div>
  );
}


export default function ControllerCompatibility({
  game,
}) {
  const controllers =
    game?.controllerCompatibility;

  if (!controllers) {
    return null;
  }

  const xbox =
    controllers.xbox ?? {};

  const playstation =
    controllers.playstation ?? {};

  const nintendo =
    controllers.nintendo ?? {};

  const dualsense =
    playstation.dualsense ?? {};

  const hasDualSense =
    typeof playstation.models ===
      "string" &&
    playstation.models
      .toLowerCase()
      .includes("dualsense");

  return (
    <section
      className="
        mt-10
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
          Controller Compatibility
        </h2>

        <p
          className="
            mt-2
            text-sm
            text-white/40
          "
        >
          Native controller and
          controller-feature support
          reported by PCGamingWiki.
        </p>
      </div>

      <div
        className="
          grid
          grid-cols-1
          gap-4
          xl:grid-cols-3
        "
      >
        <ControllerCard
          title="Xbox / XInput"
          subtitle="Xbox-compatible controllers"
        >
          <DetailRow
            label="Support"
            value={
              xbox.supported
            }
            supportValue
          />

          <DetailRow
            label="Models"
            value={
              xbox.models
            }
          />
        </ControllerCard>


        <ControllerCard
          title="PlayStation"
          subtitle="DualShock and DualSense"
        >
          <DetailRow
            label="Support"
            value={
              playstation.supported
            }
            supportValue
          />

          <DetailRow
            label="Models"
            value={
              playstation.models
            }
          />

          <DetailRow
            label="PlayStation Prompts"
            value={
              playstation.prompts
            }
            supportValue
          />

          <DetailRow
            label="Connection"
            value={
              playstation.connectionModes
            }
          />
        </ControllerCard>


        <ControllerCard
          title="Nintendo"
          subtitle="Nintendo controller support"
        >
          <DetailRow
            label="Support"
            value={
              nintendo.supported
            }
            supportValue
          />

          <DetailRow
            label="Models"
            value={
              nintendo.models
            }
          />
        </ControllerCard>
      </div>


      {hasDualSense ? (
        <div
          className="
            mt-6
            rounded-xl
            border
            border-white/10
            bg-white/[0.025]
            p-5
          "
        >
          <div
            className="
              mb-4
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-lg
                bg-violet-500/10
                text-violet-300
              "
            >
              <Gamepad2
                className="h-5 w-5"
              />
            </div>

            <div>
              <h3
                className="
                  text-base
                  font-semibold
                  text-white
                "
              >
                DualSense Features
              </h3>

              <p
                className="
                  mt-0.5
                  text-sm
                  text-white/40
                "
              >
                Native PlayStation 5
                controller capabilities
              </p>
            </div>
          </div>

          <div
            className="
              grid
              grid-cols-1
              gap-3
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            <DualSenseFeature
              icon={Zap}
              label="Adaptive Triggers"
              value={
                dualsense.adaptiveTriggers
              }
            />

            <DualSenseFeature
              icon={Radio}
              label="Haptic Feedback"
              value={
                dualsense.haptics
              }
            />

            <DualSenseFeature
              icon={Zap}
              label="Light Bar"
              value={
                playstation.lightBar
              }
            />

            <div
              className="
                flex
                items-center
                justify-between
                gap-4
                rounded-lg
                border
                border-white/[0.07]
                bg-white/[0.025]
                px-4
                py-3
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    bg-white/[0.05]
                    text-white/70
                  "
                >
                  <Radio
                    className="h-4 w-4"
                  />
                </div>

                <span
                  className="
                    text-sm
                    font-medium
                    text-white/80
                  "
                >
                  Adaptive Trigger Connection
                </span>
              </div>

              <span
                className="
                  max-w-[55%]
                  text-right
                  text-sm
                  text-white/70
                "
              >
                {formatControllerText(
                  dualsense.adaptiveTriggerModes
                )}
              </span>
            </div>

            <DualSenseFeature
              icon={Gamepad2}
              label="Motion Sensors"
              value={
                playstation.motionSensors
              }
            />

            <DualSenseFeature
              icon={Gamepad2}
              label="Controller Hotplug"
              value={
                controllers.hotplug
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}