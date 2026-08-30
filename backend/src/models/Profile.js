import mongoose from 'mongoose';

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'diverse', 'not_specified'],
  },
  dateOfBirth: {
    type: Date,
  },
  biography: {
    type: String,
  },
  height: {
    type: String,
  },
  weight: {
    type: String,
  },
  eyeColor: {
    type: String,
  },
  hairColor: {
    type: String,
  },
  location: {
    type: String,
  },
  citizenship: {
    type: String,
  },
  // Spielalter, e.g. "30-40". The profile form has always had this field; the
  // schema did not, so Mongoose dropped it on every save.
  actingAge: {
    type: String,
  },
  languages: [{
    language: String,
    level: String,
  }],
  skills: [String],
  specialSkills: [String],
  // Agency representation. Same story as actingAge: the form collects it, the
  // schema had nowhere to put it.
  agent: {
    name: String,
    email: String,
    phone: String,
  },
  avatar: {
    type: String,
  },
  setcard: {
    photos: [{
      id: String,
      title: String,
      description: String,
      url: String,
      type: {
        type: String,
        enum: ['portrait', 'fullbody', 'character', 'scene', 'other'],
        default: 'other',
      },
      isPrimary: Boolean,
      uploadedAt: Date,
    }],
    lastUpdated: Date,
  },
  /**
   * The one video a profile leads with. Kept because the profile view shows a
   * single showreel; `videos` below holds everything, this points at the one
   * that represents the actor.
   */
  showreel: {
    url: String,
    description: String,
    platform: String,
    uploadedAt: Date,
  },
  /**
   * Every video the platforms hold. A profile is not limited to one - JobWork
   * alone carries a reel that the old single field could not represent, and
   * dropping the rest silently is how an import looks complete while losing
   * things.
   */
  videos: [{
    url: String,
    title: String,
    type: {
      type: String,
      enum: ['showreel', 'scene', 'selftape', 'other'],
      default: 'other',
    },
    platform: String,
    uploadedAt: Date,
  }],
  socialMedia: {
    instagram: String,
    facebook: String,
    twitter: String,
    website: String,
    youtube: String,
    linkedin: String,
  },
  contact: {
    email: String,
    phone: String,
    address: String,
  },
  workHistory: [{
    id: String,
    title: String,
    role: String,
    production: String,
    director: String,
    company: String,
    year: String,
    description: String,
    type: {
      type: String,
      enum: ['tv', 'film', 'theater', 'commercial', 'other'],
      default: 'other',
    },
  }],
  education: [{
    id: String,
    institution: String,
    degree: String,
    field: String,
    startYear: String,
    endYear: String,
    description: String,
  }],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const Profile = mongoose.model('Profile', ProfileSchema);

export default Profile;
