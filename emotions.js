'use strict';
// Mood-meter emotions: x = pleasantness, y = energy.
// Each quadrant is a 5×5 block written row by row, top → bottom, left → right,
// as it sits in the full 10×10 grid (so the outer corners are the most intense).

const QUADRANTS = {
  red: { name: 'Red', label: 'High energy · Unpleasant', hint: 'angry, anxious, stressed, craving' },
  yellow: { name: 'Yellow', label: 'High energy · Pleasant', hint: 'excited, motivated, proud, happy' },
  blue: { name: 'Blue', label: 'Low energy · Unpleasant', hint: 'sad, lonely, drained, bored' },
  green: { name: 'Green', label: 'Low energy · Pleasant', hint: 'calm, content, grateful, relaxed' },
};

const EMOTION_ROWS = {
  red: [
    [['Enraged', 'Anger so intense it feels like it could spill over into action.'],
     ['Panicked', 'A surge of alarm where your body screams that something must happen now.'],
     ['Furious', 'Hot, strong anger aimed at someone or something that crossed a line.'],
     ['Frantic', 'Rushing and scattered, trying to do everything at once with no footing.'],
     ['Shocked', 'Jolted by something unexpected and unpleasant; your mind is scrambling to catch up.']],
    [['Terrified', 'Deep fear of a threat that feels close and serious.'],
     ['Overwhelmed', 'Too much coming at you at once, more than you feel able to handle.'],
     ['Angry', 'A clear sense that something is wrong or unfair, with energy to push back.'],
     ['Stressed', 'Under pressure from demands that feel bigger than your time or resources.'],
     ['Jittery', 'Shaky, buzzy energy in the body that won’t settle.']],
    [['Anxious', 'Worry about what might happen, with a body that’s braced for it.'],
     ['Frustrated', 'Blocked from something you want, again and again.'],
     ['Craving', 'A strong pull toward a specific thing, with your attention narrowing onto it.'],
     ['Restless', 'Unable to sit still or settle; itching to do something, anything.'],
     ['Tense', 'Tight muscles and a guarded mind, waiting for something to go wrong.']],
    [['Resentful', 'Lingering bitterness about being treated unfairly.'],
     ['Irritated', 'Small things are getting under your skin more than usual.'],
     ['Nervous', 'Uneasy anticipation before something that matters to you.'],
     ['Agitated', 'Stirred up and on edge, with a short fuse.'],
     ['Uneasy', 'A vague sense that something is off, even if you can’t name it.']],
    [['Jealous', 'Wanting what someone else has, or fearing you’ll lose what’s yours.'],
     ['Annoyed', 'Mildly bothered by someone or something getting in your way.'],
     ['Worried', 'Your thoughts keep circling back to a possible problem.'],
     ['Impatient', 'Wanting things to move faster than they are.'],
     ['Concerned', 'Paying attention to something that might need care or action.']],
  ],
  yellow: [
    [['Surprised', 'Caught off guard by something unexpected, in a good way.'],
     ['Hyper', 'Buzzing with energy that’s hard to direct.'],
     ['Thrilled', 'A rush of delight about something happening right now.'],
     ['Exhilarated', 'Intensely alive, as if after a big win or an adrenaline rush.'],
     ['Ecstatic', 'Overflowing joy that feels almost too big to contain.']],
    [['Energized', 'Charged up and ready to go.'],
     ['Lively', 'Animated and engaged, with energy that others can feel.'],
     ['Excited', 'Looking forward to something with eager energy.'],
     ['Inspired', 'Moved by an idea or example, and wanting to create or act.'],
     ['Elated', 'Soaring happiness, often after good news or a success.']],
    [['Motivated', 'You have a reason to act and the drive to follow through.'],
     ['Eager', 'Keen and ready to start.'],
     ['Enthusiastic', 'Wholehearted interest and energy for what you’re doing.'],
     ['Joyful', 'Warm, bright happiness that lifts everything.'],
     ['Proud', 'Satisfied with something you did or who you are becoming.']],
    [['Focused', 'Your attention is steady and pointed where you want it.'],
     ['Hopeful', 'Believing things can go well, and leaning toward that future.'],
     ['Optimistic', 'Expecting good outcomes, and ready to act on that.'],
     ['Happy', 'A general sense of feeling good about how things are going.'],
     ['Confident', 'Trusting yourself to handle what’s in front of you.']],
    [['Pleasant', 'Mildly good, with nothing pulling at you.'],
     ['Curious', 'Interested and wanting to know more.'],
     ['Upbeat', 'In a positive, forward-leaning mood.'],
     ['Playful', 'Light, fun, and ready to not take things too seriously.'],
     ['Cheerful', 'Bright and easy to smile.']],
  ],
  blue: [
    [['Ashamed', 'Feeling that you are bad or flawed, not just that you did something bad.'],
     ['Guilty', 'Regret about something you did that went against your values.'],
     ['Disappointed', 'Things didn’t turn out the way you hoped.'],
     ['Down', 'Low and heavy, without a clear reason.'],
     ['Bored', 'Nothing holds your interest; time drags.']],
    [['Lonely', 'Wanting connection and feeling like it isn’t there.'],
     ['Sad', 'A heavy ache about a loss or something that matters.'],
     ['Discouraged', 'Losing confidence that effort will pay off.'],
     ['Numb', 'Cut off from feelings, as if everything is muffled.'],
     ['Tired', 'Low on energy and wanting rest.']],
    [['Hopeless', 'Feeling that nothing you do will make things better.'],
     ['Heartbroken', 'Deep pain from losing someone or something you loved.'],
     ['Empty', 'A hollow feeling, as if something important is missing.'],
     ['Drained', 'Your energy has been used up by people or demands.'],
     ['Unmotivated', 'You know what you could do, but can’t find the drive to start.']],
    [['Depressed', 'A persistent low that colors everything and saps energy.'],
     ['Worthless', 'Feeling that you don’t matter or aren’t good enough.'],
     ['Isolated', 'Cut off from others, whether by circumstance or by pulling away.'],
     ['Exhausted', 'Deeply worn out in body or mind.'],
     ['Sluggish', 'Slow and heavy, as if moving through mud.']],
    [['Despairing', 'The deepest low, where hope feels completely out of reach.'],
     ['Defeated', 'Feeling beaten, as if you’ve lost the fight.'],
     ['Burned out', 'Worn down by long-term stress until you have nothing left.'],
     ['Withdrawn', 'Pulling away from people and activities you usually care about.'],
     ['Listless', 'No energy or interest in doing anything at all.']],
  ],
  green: [
    [['At ease', 'Comfortable and unbothered; nothing to guard against.'],
     ['Content', 'Satisfied with how things are right now.'],
     ['Grateful', 'Appreciating something or someone in your life.'],
     ['Loving', 'Warmth and care flowing toward someone.'],
     ['Fulfilled', 'A deep sense that your life, or this moment, is meaningful.']],
    [['Chill', 'Easygoing and relaxed, going with the flow.'],
     ['Calm', 'Settled and steady, with a quiet mind.'],
     ['Balanced', 'Things feel in proportion: not too much, not too little.'],
     ['Secure', 'Safe and supported; you can let your guard down.'],
     ['Blissful', 'A soft, glowing happiness.']],
    [['Comfortable', 'Physically and emotionally at home.'],
     ['Relieved', 'A weight has lifted; something you worried about is over.'],
     ['Settled', 'Grounded, as if things have found their place.'],
     ['Tender', 'Soft and open-hearted, gentle toward yourself or others.'],
     ['Peaceful', 'Deep inner quiet; nothing needs to change.']],
    [['Mellow', 'Low-key and pleasant, without much going on.'],
     ['Relaxed', 'Your body and mind have let go of tension.'],
     ['Cozy', 'Warm, snug, and sheltered.'],
     ['Accepting', 'Letting things be as they are, without a fight.'],
     ['Tranquil', 'Still and serene, like calm water.']],
    [['Sleepy', 'Pleasantly drowsy and ready to rest.'],
     ['Reflective', 'Quietly thinking things over.'],
     ['Patient', 'Willing to wait without frustration.'],
     ['Restful', 'Recharging and recovering at an easy pace.'],
     ['Serene', 'Profound calm and clarity, untroubled by anything.']],
  ],
};

// Flatten into { word, desc, quad, row, col, intensity } on a 10×10 grid.
const EMOTIONS = (() => {
  const offs = { red: [0, 0], yellow: [0, 5], blue: [5, 0], green: [5, 5] };
  const list = [];
  for (const [quad, rows] of Object.entries(EMOTION_ROWS)) {
    rows.forEach((row, r) => row.forEach(([word, desc], c) => {
      const R = offs[quad][0] + r, C = offs[quad][1] + c;
      // Intensity 1 (near center) … 5 (outer corner)
      const intensity = Math.max(Math.abs(R - 4.5), Math.abs(C - 4.5)) + .5;
      list.push({ word, desc, quad, row: R, col: C, intensity });
    }));
  }
  return list;
})();
const EMOTION_BY_WORD = Object.fromEntries(EMOTIONS.map(e => [e.word, e]));
