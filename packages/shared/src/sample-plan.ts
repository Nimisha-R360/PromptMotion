import { VideoPlanSchema } from "./video-plan";

/** A hand-written plan for testing. Parsing it means it can never drift out of date with the schema. */
export const samplePlan = VideoPlanSchema.parse({
  title: "Why the Sky Is Blue",
  scenes: [
    {
      id: "s1",
      type: "title",
      durationSec: 3,
      heading: "Why the Sky Is Blue",
      subheading: "A 15-second explainer",
      narration: "Ever wondered why the sky is blue?",
      animation: "zoom",
    },
    {
      id: "s2",
      type: "bullets",
      durationSec: 6,
      heading: "Rayleigh scattering",
      bullets: [
        "Sunlight contains every color",
        "Air molecules scatter short wavelengths most",
        "Blue light gets scattered all across the sky",
      ],
      narration:
        "Sunlight mixes every color. Air scatters short blue waves far more than red ones.",
      animation: "slide-up",
      transition: "fade",
    },
    {
      id: "s3",
      type: "dialogue",
      durationSec: 6,
      lines: [
        { speaker: "Kid", text: "So why aren't sunsets blue?" },
        { speaker: "Scientist", text: "At sunset, light travels through more air." },
        { speaker: "Scientist", text: "The blue scatters away and reds are left over." },
      ],
      narration: "And at sunset, the longer path through the air leaves mostly reds and oranges.",
      animation: "fade",
      transition: "slide-left",
    },
  ],
});
