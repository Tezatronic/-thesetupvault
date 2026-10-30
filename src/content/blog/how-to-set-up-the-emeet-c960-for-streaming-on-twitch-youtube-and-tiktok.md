---
title: "How to Set Up the EMEET C960 for Streaming on Twitch, YouTube, and TikTok"
description: "A step-by-step streaming guide for the EMEET C960. Learn the optimal OBS settings, framing adjustments, and audio tweaks for clean live video."
pubDate: 2026-10-30
---

Getting clean broadcast quality out of a budget webcam for streaming comes down to software calibration, proper framing, and manual exposure control. The EMEET C960 1080P Webcam provides a reliable 1080p video feed at 30fps with a wide 90-degree field of view straight out of the box, making it an accessible plug-and-play camera for live broadcasting. However, leaving this camera on default settings inside your broadcasting software will result in washed-out video, unwanted room clutter in the background, and sluggish frame pacing.

By locking your resolution manually, cropping the wide lens, and handling audio correctly, you can produce a sharp, professional stream presentation on Twitch, YouTube, or TikTok without spending hundreds on a dedicated DSLR capture setup.

## Step 1: Physical Placement and Distance

Before opening your broadcasting software, address the physical placement of the camera. The C960 is a USB plug-and-play device that requires no manual driver installation, meaning your operating system recognizes it immediately when connected.

To get the cleanest picture, keep the optical design in mind:

* **Respect the focal plane:** The C960 uses a fixed focal range of 11.8 to 118.1 inches. Unlike autofocus cameras that hunt and pulse whenever your hands move across the frame, a fixed-focus lens keeps everything in sharp focus within that window. Position your chair between 24 and 36 inches away from the lens to sit squarely in the sharpest section of that range.
* **Camera height:** Mounting the webcam directly on top of your primary gaming monitor is standard, but if that monitor sits high, viewers will spend the stream looking up your nose. Keeping your lens aligned with your eye line creates a direct connection with your audience. If you use a laptop screen or secondary display off to the side, consider [raising your webcam to eye level](/blog/raise-your-webcam-to-eye-level-video-conference-ergonomics-with-the-lamicall-adjustable-laptop-stand/) with an adjustable riser or arm mount rather than capturing a steep upward angle.
* **USB port allocation:** Plug the webcam directly into your computer's motherboard or dedicated rear I/O panel whenever possible. If you route the camera through a desktop splitter alongside an external capture card, external SSD, and keyboard, bandwidth bottlenecks can cause dropped frames. If you run into stuttering or dropped signals, reviewing standard [USB hub troubleshooting](/blog/usb-hub-troubleshooting-fix-connectivity-speed-and-power-issues-in-your-home-office/) steps can help isolate bandwidth conflicts across shared host controllers.

## Step 2: The EMEET C960 OBS Setup for Twitch and YouTube

Open OBS Studio (or Streamlabs Desktop) to configure your video capture source. Relying on the default "Device Default" preset in OBS frequently leads to compressed color ranges or erratic framerates.

### Configure the Video Capture Device

1. In the **Sources** panel, click the **+** icon and select **Video Capture Device**.
2. Name the source `EMEET C960` and click **OK**.
3. In the device dropdown, choose **eMeet C960**.
4. Change **Resolution/FPS Type** from *Device Default* to **Custom**.
5. Set **Resolution** to `1920x1080`.
6. Set **FPS** to `Match Output FPS` or manually lock it to `30`. The C960 natively outputs 1080p at 30fps; forcing OBS to request 60fps from the device can cause frame stutter as the software duplicates frames.
7. Set **Video Format** to `Any` or `MJPEG` for the lowest latency.
8. Set **Color Space** to `709` and **Color Range** to `Partial` (standard broadcast range) to prevent crushed shadows.

### Manually Lock the Exposure

Webcams adjust brightness automatically by altering exposure time. In a dim room, the C960 will slow down its shutter speed to pull in more light, which causes noticeable motion blur whenever you move your head.

Click **Configure Video** inside the OBS Video Capture Device properties to open the camera's internal driver panel:

1. Navigate to the **Camera Control** tab.
2. Uncheck **Auto** next to **Exposure**.
3. Adjust the slider manually until your face is exposed properly without motion ghosting. 
4. If the image looks dark once auto-exposure is turned off, do not compensate by cranking up the software brightness slider (which introduces digital noise). Instead, increase your physical room lighting.

## Step 3: Cropping the 90-Degree Field of View

The C960 features an expansive 90-degree field of view. While a wide lens works well when multiple people are sitting in front of a conference room table, it creates a serious visual problem for a solo gaming streamer: it reveals your entire room, including laundry piles, open doors, and peripheral clutter.

For a Twitch or YouTube gaming overlay:

1. In OBS, select your webcam source in the preview canvas.
2. Hold down the **Alt** key on Windows (or **Option** on macOS).
3. Click and drag the red bounding box handles on the left and right sides toward your shoulders.
4. Cropping the feed strips away the extra background, transforming an overly wide room shot into a clean, focused head-and-shoulders facecam.
5. Once cropped, position the frame over your gameplay scene and lock the source so you do not accidentally move it mid-broadcast.

If you produce "Just Chatting" full-screen content, use the **Scale/Aspect Ratio** filter in OBS or apply a slight digital zoom (1.1x to 1.2x) to tighten the wide lens without significantly degrading the 1080p feed.

## Step 4: Vertical Video for TikTok Live and Shorts

Vertical streaming requires a 9:16 aspect ratio (1080x1920). Because the C960 outputs a standard 16:9 horizontal image (1920x1080), putting it on TikTok Live requires deliberate framing adjustments.

You have two practical approaches:

* **Software Cropping (Easiest):** In TikTok Live Studio or an OBS vertical canvas plugin, place the 1080p feed in the center and crop the left and right edges heavily until it fills the vertical container. Because the C960 has a generous 90-degree lens, you can sit at standard desk distance and still have plenty of shoulder and head room after the horizontal sides are cut away.
* **Physical Sensor Rotation (Highest Resolution):** If you mount the webcam on an adjustable ball head or monitor clamp that can tilt 90 degrees sideways, you can physically orient the camera in portrait mode. In OBS, rotate the source 90 degrees clockwise in the transform menu. This lets you use the full 1080-pixel width across the vertical axis, giving you significantly sharper video on mobile screens.

Whenever your stream ends, remember to flip down the included privacy cover over the lens for peace of mind between sessions.

## Step 5: Audio Routing and Microphone Management

The EMEET C960 includes 2 built-in omnidirectional noise-reduction microphones with an effective pickup range of up to approximately 2.4 meters. 

For quick, casual streaming on TikTok Live directly from a desktop, these microphones are functional and pick up voice audio clearly across the room. However, for serious content creation on Twitch or YouTube, omnidirectional microphones pick up too much ambient mechanical keyboard clicking, desk taps, and PC fan whine.

The best practice for any dedicated live stream is to separate your video source from your audio source:

1. In OBS, open **Settings > Audio**.
2. Set your primary microphone to a dedicated cardioid dynamic or USB condenser mic.
3. In the OBS **Audio Mixer**, look for the EMEET C960 audio channel.
4. Click the speaker icon to **Mute** the webcam's built-in microphones entirely, or right-click the video source properties, set **Audio Output Mode** to *Capture audio only*, and ensure the source is hidden from your active mixer.

Using the C960 strictly as a video capture device while routing your audio through a dedicated microphone instantly elevates the perceived production value of your broadcast.

## Potential Drawbacks

While the C960 is an effective tool for getting started with streaming, it has specific physical constraints you must plan around:

* **30fps Limit:** The camera caps out at 1080p at 30fps. If you stream fast-paced esports (like first-person shooters running at 60fps), your facecam will operate at half the framerate of your gameplay. For most reaction content and casual gaming, 30fps is completely standard, but high-motion creators may want a 60fps unit down the road.
* **Fixed Focal Range Constraints:** The fixed focal plane runs from 11.8 to 118.1 inches. If you host unboxing streams, hobby crafting tutorials, or product review videos on YouTube where you hold small items right up to the lens, the camera cannot focus closer than 11.8 inches. Objects brought within a few inches of the glass will appear blurry.

## Final Setup Checklist

Before you hit "Go Live," run through this rapid calibration checklist:

1. **Lens clean:** Wipe the glass lens with a microfiber cloth to remove skin oils and dust.
2. **Exposure locked:** Confirm that the auto-exposure toggle is off in your camera properties to prevent shutter-speed jitter.
3. **Framing tightened:** Hold Alt in OBS to crop the 90-degree field of view to fit your chosen stream overlay.
4. **Lighting balanced:** Ensure your primary light source is facing you from behind the monitor, keeping your face clear without pushing the camera's digital gain.
5. **Mic muted:** Confirm in your audio mixer that OBS is receiving your voice through your dedicated microphone rather than the camera's built-in omnidirectional array.

With these five elements configured, the C960 outputs a reliable, high-clarity broadcast image that rivals far more expensive camera rigs.