import React from "react";
import {
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

export default class AppErrorBoundary
  extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(
    error
  ) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(
    error,
    info
  ) {
    console.error(
      "[GameAtlas] UI error:",
      error,
      info
    );
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message =
      this.state.error?.message
      ?? String(
        this.state.error
        ?? "Unknown UI error"
      );

    return (
      <div
        className="
          flex
          min-h-[240px]
          w-full
          items-center
          justify-center
          p-6
        "
      >
        <div
          className="
            w-full
            max-w-xl
            rounded-2xl
            border
            border-red-500/20
            bg-red-500/[0.045]
            p-6
          "
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <AlertTriangle
              className="
                mt-0.5
                h-5
                w-5
                shrink-0
                text-red-300/80
              "
            />

            <div
              className="
                min-w-0
                flex-1
              "
            >
              <div
                className="
                  text-sm
                  font-semibold
                  text-red-200
                "
              >
                This section encountered an error
              </div>

              <div
                className="
                  mt-2
                  break-words
                  text-xs
                  leading-relaxed
                  text-red-100/45
                "
              >
                {message}
              </div>

              <div
                className="
                  mt-2
                  text-xs
                  text-white/28
                "
              >
                GameAtlas kept the rest of the interface running instead of showing a blank screen.
              </div>

              <button
                type="button"
                onClick={this.reset}
                className="
                  mt-4
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.035]
                  px-3
                  py-2
                  text-xs
                  text-white/65
                  hover:bg-white/[0.07]
                  hover:text-white/85
                "
              >
                <RefreshCcw
                  className="h-3.5 w-3.5"
                />

                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
