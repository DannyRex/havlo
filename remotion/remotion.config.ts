/* Remotion render config. Docs: https://remotion.dev/docs/config */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
/* H.264 in an MP4 container — broadest <video> compatibility for the
   homepage embed. A WebM/VP9 sibling can be added later for smaller
   files on supporting browsers. */
Config.setCodec("h264");
Config.setColorSpace("bt709");
