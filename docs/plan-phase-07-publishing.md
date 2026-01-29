# Phase 7: Content Publishing from Desktop

> Enable users to create and upload Platform content (photos, stories, reels)
> directly from their desktop browser.

## Objectives

- Upload photos with captions, hashtags, and location tags
- Upload stories with basic customization
- Upload reels with cover frame selection
- Create carousel posts (multiple images)
- Provide a content creation interface in the options page

---

## Deliverables

### 7.1 Upload API Integration

```typescript
// src/api/endpoints/upload.ts
```

**Upload flow (Platform's internal process):**
1. Request upload URL from Platform
2. Upload media binary to the upload URL
3. Configure the post (caption, location, tags)
4. Publish the configured media

**Endpoints:**

```typescript
// Step 1: Get upload URL
// POST https://www.platform.com/rupload_igphoto/{uploadId}
// Headers: X-Platform-Rupload-Params (JSON with upload metadata)

// Step 2: Upload binary
// POST to the upload URL with binary body
// Content-Type: image/jpeg or video/mp4

// Step 3: Configure & publish photo
// POST https://www.platform.com/api/v1/media/configure/
// Body: caption, location, usertags, etc.

// Step 3 alt: Configure & publish story
// POST https://www.platform.com/api/v1/media/configure_to_story/

// Step 3 alt: Configure & publish reel
// POST https://www.platform.com/api/v1/media/configure_to_clips/
```

```typescript
export interface UploadPhotoParams {
  imageBlob: Blob;
  caption: string;
  location?: LocationTag;
  userTags?: UserTag[];
  altText?: string;
}

export interface UploadStoryParams {
  imageBlob: Blob;
  mentions?: StoryMention[];
  links?: StoryLink[];
}

export interface UploadReelParams {
  videoBlob: Blob;
  coverImageBlob?: Blob;
  caption: string;
  location?: LocationTag;
  audioName?: string;
}

export async function uploadPhoto(params: UploadPhotoParams): Promise<MediaResult>;
export async function uploadStory(params: UploadStoryParams): Promise<MediaResult>;
export async function uploadReel(params: UploadReelParams): Promise<MediaResult>;
export async function uploadCarousel(images: Blob[], caption: string): Promise<MediaResult>;
```

### 7.2 Image Processing

```typescript
// src/lib/image-processor.ts
```

**Client-side processing using Canvas API:**
- Resize images to Platform's requirements (1080x1080, 1080x1350, 1080x608)
- Compress JPEG to target file size
- Generate thumbnails for preview
- Crop tool with aspect ratio presets (1:1, 4:5, 16:9)
- EXIF data stripping for privacy

```typescript
export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  aspectRatio: string;
  sizeBytes: number;
}

export async function processImage(
  file: File,
  options: {
    maxWidth: number;
    maxHeight: number;
    quality: number;       // 0.0 - 1.0
    format: "jpeg" | "webp";
  }
): Promise<ProcessedImage>;

export async function generateThumbnail(
  file: File,
  size: number
): Promise<Blob>;
```

### 7.3 Location Search

```typescript
// src/api/endpoints/location.ts

// GET https://www.platform.com/api/v1/location_search/
//   ?search_query={query}&latitude=0&longitude=0
export async function searchLocations(query: string): Promise<LocationResult[]>;

export interface LocationResult {
  pk: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}
```

### 7.4 Hashtag Research

```typescript
// src/api/endpoints/hashtags.ts

// GET https://www.platform.com/api/v1/tags/search/?q={query}
export async function searchHashtags(query: string): Promise<HashtagResult[]>;

// GET https://www.platform.com/api/v1/tags/{tag}/info/
export async function getHashtagInfo(tag: string): Promise<HashtagInfo>;

export interface HashtagResult {
  name: string;
  media_count: number;
}

export interface HashtagInfo {
  name: string;
  media_count: number;
  related_tags: string[];
}
```

### 7.5 Publishing UI

```typescript
// src/options/components/publishing/
```

**Components:**

| Component | Function |
|-----------|----------|
| `PhotoUploader.tsx` | Drag-drop image upload with preview |
| `CaptionEditor.tsx` | Text area with character count, hashtag suggestions |
| `ImageCropper.tsx` | Crop tool with aspect ratio presets |
| `LocationPicker.tsx` | Location search and selection |
| `HashtagSuggester.tsx` | Hashtag search with volume indicators |
| `PublishButton.tsx` | Upload trigger with progress indicator |
| `CarouselBuilder.tsx` | Multi-image ordering and management |

---

## Module Structure

```
src/api/endpoints/
├── upload.ts              # Upload and configure endpoints
├── location.ts            # Location search
└── hashtags.ts            # Hashtag search and info

src/lib/
└── image-processor.ts     # Canvas-based image processing

src/options/components/publishing/
├── PhotoUploader.tsx
├── CaptionEditor.tsx
├── ImageCropper.tsx
├── LocationPicker.tsx
├── HashtagSuggester.tsx
├── PublishButton.tsx
└── CarouselBuilder.tsx
```

---

## Testing Strategy

### Unit Tests
- `image-processor.test.ts` — resize, compress, aspect ratio calculations
- `upload.test.ts` — mock upload flow, verify request format

### Component Tests
- Image upload preview renders
- Caption editor counts characters correctly
- Location picker displays search results

---

## Acceptance Criteria

- [ ] Users can upload a single photo with caption from desktop
- [ ] Images are resized and compressed client-side before upload
- [ ] Carousel posts support 2-10 images
- [ ] Story upload works with basic image
- [ ] Location search returns relevant results
- [ ] Hashtag search shows volume/popularity data
- [ ] Upload progress indicator shows real-time status
- [ ] Error handling for failed uploads with retry option
- [ ] EXIF data stripped from uploaded images
