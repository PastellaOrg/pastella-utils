/**
 * Pastella Utils
 */

import * as Ed25519 from '@noble/ed25519';
import sha3 from 'js-sha3';
import * as crypto from 'crypto';
import { WALLET_ADDRESS_PREFIX, DECIMALS, TICKER } from './config';

const keccak256 = sha3.keccak256;

// ============================================================================
// WORDLIST
// ============================================================================
const WORDLIST = [
  'abbey', 'abducts', 'ability', 'ablaze', 'abnormal', 'abort', 'abrasive', 'absorb', 
  'abyss', 'academy', 'aces', 'aching', 'acidic', 'acoustic', 'acquire', 'across', 
  'actress', 'acumen', 'adapt', 'addicted', 'adept', 'adhesive', 'adjust', 'adopt', 
  'adrenalin', 'adult', 'adventure', 'aerial', 'afar', 'affair', 'afield', 'afloat', 
  'afoot', 'afraid', 'after', 'against', 'agenda', 'aggravate', 'agile', 'aglow', 
  'agnostic', 'agony', 'agreed', 'ahead', 'aided', 'ailments', 'aimless', 'airport', 
  'aisle', 'ajar', 'akin', 'alarms', 'album', 'alchemy', 'alerts', 'algebra', 
  'alkaline', 'alley', 'almost', 'aloof', 'alpine', 'already', 'also', 'altitude', 
  'alumni', 'always', 'amaze', 'ambush', 'amended', 'amidst', 'ammo', 'amnesty', 
  'among', 'amply', 'amused', 'anchor', 'android', 'anecdote', 'angled', 'ankle', 
  'annoyed', 'answers', 'antics', 'anvil', 'anxiety', 'anybody', 'apart', 'apex', 
  'aphid', 'aplomb', 'apology', 'apply', 'apricot', 'aptitude', 'aquarium', 'arbitrary', 
  'archer', 'ardent', 'arena', 'argue', 'arises', 'army', 'around', 'arrow', 
  'arsenic', 'artistic', 'ascend', 'ashtray', 'aside', 'asked', 'asleep', 'aspire', 
  'assorted', 'asylum', 'athlete', 'atlas', 'atom', 'atrium', 'attire', 'auburn', 
  'auctions', 'audio', 'august', 'aunt', 'austere', 'autumn', 'avatar', 'avidly', 
  'avoid', 'awakened', 'awesome', 'awful', 'awkward', 'awning', 'awoken', 'axes', 
  'axis', 'axle', 'aztec', 'azure', 'baby', 'bacon', 'badge', 'baffles', 
  'bagpipe', 'bailed', 'bakery', 'balding', 'bamboo', 'banjo', 'baptism', 'basin', 
  'batch', 'bawled', 'bays', 'because', 'beer', 'befit', 'begun', 'behind', 
  'being', 'below', 'bemused', 'benches', 'berries', 'bested', 'betting', 'bevel', 
  'beware', 'beyond', 'bias', 'bicycle', 'bids', 'bifocals', 'biggest', 'bikini', 
  'bimonthly', 'binocular', 'biology', 'biplane', 'birth', 'biscuit', 'bite', 'biweekly', 
  'blender', 'blip', 'bluntly', 'boat', 'bobsled', 'bodies', 'bogeys', 'boil', 
  'boldly', 'bomb', 'border', 'boss', 'both', 'bounced', 'bovine', 'bowling', 
  'boxes', 'boyfriend', 'broken', 'brunt', 'bubble', 'buckets', 'budget', 'buffet', 
  'bugs', 'building', 'bulb', 'bumper', 'bunch', 'business', 'butter', 'buying', 
  'buzzer', 'bygones', 'byline', 'bypass', 'cabin', 'cactus', 'cadets', 'cafe', 
  'cage', 'cajun', 'cake', 'calamity', 'camp', 'candy', 'casket', 'catch', 
  'cause', 'cavernous', 'cease', 'cedar', 'ceiling', 'cell', 'cement', 'cent', 
  'certain', 'chlorine', 'chrome', 'cider', 'cigar', 'cinema', 'circle', 'cistern', 
  'citadel', 'civilian', 'claim', 'click', 'clue', 'coal', 'cobra', 'cocoa', 
  'code', 'coexist', 'coffee', 'cogs', 'cohesive', 'coils', 'colony', 'comb', 
  'cool', 'copy', 'corrode', 'costume', 'cottage', 'cousin', 'cowl', 'criminal', 
  'cube', 'cucumber', 'cuddled', 'cuffs', 'cuisine', 'cunning', 'cupcake', 'custom', 
  'cycling', 'cylinder', 'cynical', 'dabbing', 'dads', 'daft', 'dagger', 'daily', 
  'damp', 'dangerous', 'dapper', 'darted', 'dash', 'dating', 'dauntless', 'dawn', 
  'daytime', 'dazed', 'debut', 'decay', 'dedicated', 'deepest', 'deftly', 'degrees', 
  'dehydrate', 'deity', 'dejected', 'delayed', 'demonstrate', 'dented', 'deodorant', 'depth', 
  'desk', 'devoid', 'dewdrop', 'dexterity', 'dialect', 'dice', 'diet', 'different', 
  'digit', 'dilute', 'dime', 'dinner', 'diode', 'diplomat', 'directed', 'distance', 
  'ditch', 'divers', 'dizzy', 'doctor', 'dodge', 'does', 'dogs', 'doing', 
  'dolphin', 'domestic', 'donuts', 'doorway', 'dormant', 'dosage', 'dotted', 'double', 
  'dove', 'down', 'dozen', 'dreams', 'drinks', 'drowning', 'drunk', 'drying', 
  'dual', 'dubbed', 'duckling', 'dude', 'duets', 'duke', 'dullness', 'dummy', 
  'dunes', 'duplex', 'duration', 'dusted', 'duties', 'dwarf', 'dwelt', 'dwindling', 
  'dying', 'dynamite', 'dyslexic', 'each', 'eagle', 'earth', 'easy', 'eating', 
  'eavesdrop', 'eccentric', 'echo', 'eclipse', 'economics', 'ecstatic', 'eden', 'edgy', 
  'edited', 'educated', 'eels', 'efficient', 'eggs', 'egotistic', 'eight', 'either', 
  'eject', 'elapse', 'elbow', 'eldest', 'eleven', 'elite', 'elope', 'else', 
  'eluded', 'emails', 'ember', 'emerge', 'emit', 'emotion', 'empty', 'emulate', 
  'energy', 'enforce', 'enhanced', 'enigma', 'enjoy', 'enlist', 'enmity', 'enough', 
  'enraged', 'ensign', 'entrance', 'envy', 'epoxy', 'equip', 'erase', 'erected', 
  'erosion', 'error', 'eskimos', 'espionage', 'essential', 'estate', 'etched', 'eternal', 
  'ethics', 'etiquette', 'evaluate', 'evenings', 'evicted', 'evolved', 'examine', 'excess', 
  'exhale', 'exit', 'exotic', 'exquisite', 'extra', 'exult', 'fabrics', 'factual', 
  'fading', 'fainted', 'faked', 'fall', 'family', 'fancy', 'farming', 'fatal', 
  'faulty', 'fawns', 'faxed', 'fazed', 'feast', 'february', 'federal', 'feel', 
  'feline', 'females', 'fences', 'ferry', 'festival', 'fetches', 'fever', 'fewest', 
  'fiat', 'fibula', 'fictional', 'fidget', 'fierce', 'fifteen', 'fight', 'films', 
  'firm', 'fishing', 'fitting', 'five', 'fixate', 'fizzle', 'fleet', 'flippant', 
  'flying', 'foamy', 'focus', 'foes', 'foggy', 'foiled', 'folding', 'fonts', 
  'foolish', 'fossil', 'fountain', 'fowls', 'foxes', 'foyer', 'framed', 'friendly', 
  'frown', 'fruit', 'frying', 'fudge', 'fuel', 'fugitive', 'fully', 'fuming', 
  'fungal', 'furnished', 'fuselage', 'future', 'fuzzy', 'gables', 'gadget', 'gags', 
  'gained', 'galaxy', 'gambit', 'gang', 'gasp', 'gather', 'gauze', 'gave', 
  'gawk', 'gaze', 'gearbox', 'gecko', 'geek', 'gels', 'gemstone', 'general', 
  'geometry', 'germs', 'gesture', 'getting', 'geyser', 'ghetto', 'ghost', 'giant', 
  'giddy', 'gifts', 'gigantic', 'gills', 'gimmick', 'ginger', 'girth', 'giving', 
  'glass', 'gleeful', 'glide', 'gnaw', 'gnome', 'goat', 'goblet', 'godfather', 
  'goes', 'goggles', 'going', 'goldfish', 'gone', 'goodbye', 'gopher', 'gorilla', 
  'gossip', 'gotten', 'gourmet', 'governing', 'gown', 'greater', 'grunt', 'guarded', 
  'guest', 'guide', 'gulp', 'gumball', 'guru', 'gusts', 'gutter', 'guys', 
  'gymnast', 'gypsy', 'gyrate', 'habitat', 'hacksaw', 'haggled', 'hairy', 'hamburger', 
  'happens', 'hashing', 'hatchet', 'haunted', 'having', 'hawk', 'haystack', 'hazard', 
  'hectare', 'hedgehog', 'heels', 'hefty', 'height', 'hemlock', 'hence', 'heron', 
  'hesitate', 'hexagon', 'hickory', 'hiding', 'highway', 'hijack', 'hiker', 'hills', 
  'himself', 'hinder', 'hippo', 'hire', 'history', 'hitched', 'hive', 'hoax', 
  'hobby', 'hockey', 'hoisting', 'hold', 'honked', 'hookup', 'hope', 'hornet', 
  'hospital', 'hotel', 'hounded', 'hover', 'howls', 'hubcaps', 'huddle', 'huge', 
  'hull', 'humid', 'hunter', 'hurried', 'husband', 'huts', 'hybrid', 'hydrogen', 
  'hyper', 'iceberg', 'icing', 'icon', 'identity', 'idiom', 'idled', 'idols', 
  'igloo', 'ignore', 'iguana', 'illness', 'imagine', 'imbalance', 'imitate', 'impel', 
  'inactive', 'inbound', 'incur', 'industrial', 'inexact', 'inflamed', 'ingested', 'initiate', 
  'injury', 'inkling', 'inline', 'inmate', 'innocent', 'inorganic', 'input', 'inquest', 
  'inroads', 'insult', 'intended', 'inundate', 'invoke', 'inwardly', 'ionic', 'irate', 
  'iris', 'irony', 'irritate', 'island', 'isolated', 'issued', 'italics', 'itches', 
  'items', 'itinerary', 'itself', 'ivory', 'jabbed', 'jackets', 'jaded', 'jagged', 
  'jailed', 'jamming', 'january', 'jargon', 'jaunt', 'javelin', 'jaws', 'jazz', 
  'jeans', 'jeers', 'jellyfish', 'jeopardy', 'jerseys', 'jester', 'jetting', 'jewels', 
  'jigsaw', 'jingle', 'jittery', 'jive', 'jobs', 'jockey', 'jogger', 'joining', 
  'joking', 'jolted', 'jostle', 'journal', 'joyous', 'jubilee', 'judge', 'juggled', 
  'juicy', 'jukebox', 'july', 'jump', 'junk', 'jury', 'justice', 'juvenile', 
  'kangaroo', 'karate', 'keep', 'kennel', 'kept', 'kernels', 'kettle', 'keyboard', 
  'kickoff', 'kidneys', 'king', 'kiosk', 'kisses', 'kitchens', 'kiwi', 'knapsack', 
  'knee', 'knife', 'knowledge', 'knuckle', 'koala', 'laboratory', 'ladder', 'lagoon', 
  'lair', 'lakes', 'lamb', 'language', 'laptop', 'large', 'last', 'later', 
  'launching', 'lava', 'lawsuit', 'layout', 'lazy', 'lectures', 'ledge', 'leech', 
  'left', 'legion', 'leisure', 'lemon', 'lending', 'leopard', 'lesson', 'lettuce', 
  'lexicon', 'liar', 'library', 'licks', 'lids', 'lied', 'lifestyle', 'light', 
  'likewise', 'lilac', 'limits', 'linen', 'lion', 'lipstick', 'liquid', 'listen', 
  'lively', 'loaded', 'lobster', 'locker', 'lodge', 'lofty', 'logic', 'loincloth', 
  'long', 'looking', 'lopped', 'lordship', 'losing', 'lottery', 'loudly', 'love', 
  'lower', 'loyal', 'lucky', 'luggage', 'lukewarm', 'lullaby', 'lumber', 'lunar', 
  'lurk', 'lush', 'luxury', 'lymph', 'lynx', 'lyrics', 'macro', 'madness', 
  'magically', 'mailed', 'major', 'makeup', 'malady', 'mammal', 'maps', 'masterful', 
  'match', 'maul', 'maverick', 'maximum', 'mayor', 'maze', 'meant', 'mechanic', 
  'medicate', 'meeting', 'megabyte', 'melting', 'memoir', 'menu', 'merger', 'mesh', 
  'metro', 'mews', 'mice', 'midst', 'mighty', 'mime', 'mirror', 'misery', 
  'mittens', 'mixture', 'moat', 'mobile', 'mocked', 'mohawk', 'moisture', 'molten', 
  'moment', 'money', 'moon', 'mops', 'morsel', 'mostly', 'motherly', 'mouth', 
  'movement', 'mowing', 'much', 'muddy', 'muffin', 'mugged', 'mullet', 'mumble', 
  'mundane', 'muppet', 'mural', 'musical', 'muzzle', 'myriad', 'mystery', 'myth', 
  'nabbing', 'nagged', 'nail', 'names', 'nanny', 'napkin', 'narrate', 'nasty', 
  'natural', 'nautical', 'navy', 'nearby', 'necklace', 'needed', 'negative', 'neither', 
  'neon', 'nephew', 'nerves', 'nestle', 'network', 'neutral', 'never', 'newt', 
  'nexus', 'nibs', 'niche', 'niece', 'nifty', 'nightly', 'nimbly', 'nineteen', 
  'nirvana', 'nitrogen', 'nobody', 'nocturnal', 'nodes', 'noises', 'nomad', 'noodles', 
  'northern', 'nostril', 'noted', 'nouns', 'novelty', 'nowhere', 'nozzle', 'nuance', 
  'nucleus', 'nudged', 'nugget', 'nuisance', 'null', 'number', 'nuns', 'nurse', 
  'nutshell', 'nylon', 'oaks', 'oars', 'oasis', 'oatmeal', 'obedient', 'object', 
  'obliged', 'obnoxious', 'observant', 'obtains', 'obvious', 'occur', 'ocean', 'october', 
  'odds', 'odometer', 'offend', 'often', 'oilfield', 'ointment', 'okay', 'older', 
  'olive', 'olympics', 'omega', 'omission', 'omnibus', 'onboard', 'oncoming', 'oneself', 
  'ongoing', 'onion', 'online', 'onslaught', 'onto', 'onward', 'oozed', 'opacity', 
  'opened', 'opposite', 'optical', 'opus', 'orange', 'orbit', 'orchid', 'orders', 
  'organs', 'origin', 'ornament', 'orphans', 'oscar', 'ostrich', 'otherwise', 'otter', 
  'ouch', 'ought', 'ounce', 'ourselves', 'oust', 'outbreak', 'oval', 'oven', 
  'owed', 'owls', 'owner', 'oxidant', 'oxygen', 'oyster', 'ozone', 'pact', 
  'paddles', 'pager', 'pairing', 'palace', 'pamphlet', 'pancakes', 'paper', 'paradise', 
  'pastry', 'patio', 'pause', 'pavements', 'pawnshop', 'payment', 'peaches', 'pebbles', 
  'peculiar', 'pedantic', 'peeled', 'pegs', 'pelican', 'pencil', 'people', 'pepper', 
  'perfect', 'pests', 'petals', 'phase', 'pheasants', 'phone', 'phrases', 'physics', 
  'piano', 'picked', 'pierce', 'pigment', 'piloted', 'pimple', 'pinched', 'pioneer', 
  'pipeline', 'pirate', 'pistons', 'pitched', 'pivot', 'pixels', 'pizza', 'playful', 
  'pledge', 'pliers', 'plotting', 'plus', 'plywood', 'poaching', 'pockets', 'podcast', 
  'poetry', 'point', 'poker', 'polar', 'ponies', 'pool', 'popular', 'portents', 
  'possible', 'potato', 'pouch', 'poverty', 'powder', 'pram', 'present', 'pride', 
  'problems', 'pruned', 'prying', 'psychic', 'public', 'puck', 'puddle', 'puffin', 
  'pulp', 'pumpkins', 'punch', 'puppy', 'purged', 'push', 'putty', 'puzzled', 
  'pylons', 'pyramid', 'python', 'queen', 'quick', 'quote', 'rabbits', 'racetrack', 
  'radar', 'rafts', 'rage', 'railway', 'raking', 'rally', 'ramped', 'randomly', 
  'rapid', 'rarest', 'rash', 'rated', 'ravine', 'rays', 'razor', 'react', 
  'rebel', 'recipe', 'reduce', 'reef', 'refer', 'regular', 'reheat', 'reinvest', 
  'rejoices', 'rekindle', 'relic', 'remedy', 'renting', 'reorder', 'repent', 'request', 
  'reruns', 'rest', 'return', 'reunion', 'revamp', 'rewind', 'rhino', 'rhythm', 
  'ribbon', 'richly', 'ridges', 'rift', 'rigid', 'rims', 'ringing', 'riots', 
  'ripped', 'rising', 'ritual', 'river', 'roared', 'robot', 'rockets', 'rodent', 
  'rogue', 'roles', 'romance', 'roomy', 'roped', 'roster', 'rotate', 'rounded', 
  'rover', 'rowboat', 'royal', 'ruby', 'rudely', 'ruffled', 'rugged', 'ruined', 
  'ruling', 'rumble', 'runway', 'rural', 'rustled', 'ruthless', 'sabotage', 'sack', 
  'sadness', 'safety', 'saga', 'sailor', 'sake', 'salads', 'sample', 'sanity', 
  'sapling', 'sarcasm', 'sash', 'satin', 'saucepan', 'saved', 'sawmill', 'saxophone', 
  'sayings', 'scamper', 'scenic', 'school', 'science', 'scoop', 'scrub', 'scuba', 
  'seasons', 'second', 'sedan', 'seeded', 'segments', 'seismic', 'selfish', 'semifinal', 
  'sensible', 'september', 'sequence', 'serving', 'session', 'setup', 'seventh', 'sewage', 
  'shackles', 'shelter', 'shipped', 'shocking', 'shrugged', 'shuffled', 'shyness', 'siblings', 
  'sickness', 'sidekick', 'sieve', 'sifting', 'sighting', 'silk', 'simplest', 'sincerely', 
  'sipped', 'siren', 'situated', 'sixteen', 'sizes', 'skater', 'skew', 'skirting', 
  'skulls', 'skydive', 'slackens', 'sleepless', 'slid', 'slower', 'slug', 'smash', 
  'smelting', 'smidgen', 'smog', 'smuggled', 'snake', 'sneeze', 'sniff', 'snout', 
  'snug', 'soapy', 'sober', 'soccer', 'soda', 'software', 'soggy', 'soil', 
  'solved', 'somewhere', 'sonic', 'soothe', 'soprano', 'sorry', 'southern', 'sovereign', 
  'sowed', 'soya', 'space', 'speedy', 'sphere', 'spiders', 'splendid', 'spout', 
  'sprig', 'spud', 'spying', 'square', 'stacking', 'stellar', 'stick', 'stockpile', 
  'strained', 'stunning', 'stylishly', 'subtly', 'succeed', 'suddenly', 'suede', 'suffice', 
  'sugar', 'suitcase', 'sulking', 'summon', 'sunken', 'superior', 'surfer', 'sushi', 
  'suture', 'swagger', 'swept', 'swiftly', 'sword', 'swung', 'syllabus', 'symptoms', 
  'syndrome', 'syringe', 'system', 'taboo', 'tacit', 'tadpoles', 'tagged', 'tail', 
  'taken', 'talent', 'tamper', 'tanks', 'tapestry', 'tarnished', 'tasked', 'tattoo', 
  'taunts', 'tavern', 'tawny', 'taxi', 'teardrop', 'technical', 'tedious', 'teeming', 
  'tell', 'template', 'tender', 'tepid', 'tequila', 'terminal', 'testing', 'tether', 
  'textbook', 'thaw', 'theatrics', 'thirsty', 'thorn', 'threaten', 'thumbs', 'thwart', 
  'ticket', 'tidy', 'tiers', 'tiger', 'tilt', 'timber', 'tinted', 'tipsy', 
  'tirade', 'tissue', 'titans', 'toaster', 'tobacco', 'today', 'toenail', 'toffee', 
  'together', 'toilet', 'token', 'tolerant', 'tomorrow', 'tonic', 'toolbox', 'topic', 
  'torch', 'tossed', 'total', 'touchy', 'towel', 'toxic', 'toyed', 'trash', 
  'trendy', 'tribal', 'trolling', 'truth', 'trying', 'tsunami', 'tubes', 'tucks', 
  'tudor', 'tuesday', 'tufts', 'tugs', 'tuition', 'tulips', 'tumbling', 'tunnel', 
  'turnip', 'tusks', 'tutor', 'tuxedo', 'twang', 'tweezers', 'twice', 'twofold', 
  'tycoon', 'typist', 'tyrant', 'ugly', 'ulcers', 'ultimate', 'umbrella', 'umpire', 
  'unafraid', 'unbending', 'uncle', 'under', 'uneven', 'unfit', 'ungainly', 'unhappy', 
  'union', 'unjustly', 'unknown', 'unlikely', 'unmask', 'unnoticed', 'unopened', 'unplugs', 
  'unquoted', 'unrest', 'unsafe', 'until', 'unusual', 'unveil', 'unwind', 'unzip', 
  'upbeat', 'upcoming', 'update', 'upgrade', 'uphill', 'upkeep', 'upload', 'upon', 
  'upper', 'upright', 'upstairs', 'uptight', 'upwards', 'urban', 'urchins', 'urgent', 
  'usage', 'useful', 'usher', 'using', 'usual', 'utensils', 'utility', 'utmost', 
  'utopia', 'uttered', 'vacation', 'vague', 'vain', 'value', 'vampire', 'vane', 
  'vapidly', 'vary', 'vastness', 'vats', 'vaults', 'vector', 'veered', 'vegan', 
  'vehicle', 'vein', 'velvet', 'venomous', 'verification', 'vessel', 'veteran', 'vexed', 
  'vials', 'vibrate', 'victim', 'video', 'viewpoint', 'vigilant', 'viking', 'village', 
  'vinegar', 'violin', 'vipers', 'virtual', 'visited', 'vitals', 'vivid', 'vixen', 
  'vocal', 'vogue', 'voice', 'volcano', 'vortex', 'voted', 'voucher', 'vowels', 
  'voyage', 'vulture', 'wade', 'waffle', 'wagtail', 'waist', 'waking', 'wallets', 
  'wanted', 'warped', 'washing', 'water', 'waveform', 'waxing', 'wayside', 'weavers', 
  'website', 'wedge', 'weekday', 'weird', 'welders', 'went', 'wept', 'were', 
  'western', 'wetsuit', 'whale', 'when', 'whipped', 'whole', 'wickets', 'width', 
  'wield', 'wife', 'wiggle', 'wildly', 'winter', 'wipeout', 'wiring', 'wise', 
  'withdrawn', 'wives', 'wizard', 'wobbly', 'woes', 'woken', 'wolf', 'womanly', 
  'wonders', 'woozy', 'worry', 'wounded', 'woven', 'wrap', 'wrist', 'wrong', 
  'yacht', 'yahoo', 'yanks', 'yard', 'yawning', 'yearbook', 'yellow', 'yesterday', 
  'yeti', 'yields', 'yodel', 'yoga', 'younger', 'yoyo', 'zapped', 'zeal', 
  'zebra', 'zero', 'zesty', 'zigzags', 'zinger', 'zippers', 'zodiac', 'zombie', 
  'zones', 'zoom', 
]

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP: Record<string, number> = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i;
}

// ============================================================================
// UTILITY FUNCTIONS (EXACT COPY)
// ============================================================================
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function crc32(str: string): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getWordIndex(word: string): number {
  const index = WORDLIST.indexOf(word);
  if (index === -1) {
    throw new Error(`Word not found in wordlist: ${word}`);
  }
  return index;
}

// ============================================================================
// MNEMONIC CONVERSION (EXACT COPY)
// ============================================================================
function mnemonicToPrivateKey(mnemonic: string): Uint8Array {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 25) {
    throw new Error('Mnemonic must have exactly 25 words');
  }

  const dataWords = words.slice(0, 24);
  const privateKeyBytes: number[] = [];

  for (let i = 0; i < 24; i += 3) {
    const w1 = getWordIndex(dataWords[i]);
    const w2 = getWordIndex(dataWords[i + 1]);
    const w3 = getWordIndex(dataWords[i + 2]);
    const wlLen = 1626;

    const val = w1 + wlLen * (((wlLen - w1) + w2) % wlLen) +
                wlLen * wlLen * (((wlLen - w2) + w3) % wlLen);

    if (val % wlLen !== w1) {
      throw new Error('Invalid mnemonic encoding');
    }

    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, val, true);

    for (let j = 0; j < 4; j++) {
      privateKeyBytes.push(view.getUint8(j));
    }
  }

  return new Uint8Array(privateKeyBytes);
}

function calculateChecksumWord(words: string[]): string {
  let trimmed = '';
  for (const word of words) {
    trimmed += word.substr(0, 3);
  }

  const hash = crc32(trimmed);
  const checksumIndex = hash % 24;

  return words[checksumIndex];
}

function verifyMnemonicChecksum(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 25) {
    return false;
  }

  const dataWords = words.slice(0, 24);
  const expectedChecksum = calculateChecksumWord(dataWords);
  const actualChecksum = words[24];

  return expectedChecksum === actualChecksum;
}

// ============================================================================
// ADDRESS GENERATION
// ============================================================================
function encodeVarint(num: number): Uint8Array {
  const bytes: number[] = [];

  while (num >= 0x80) {
    const byte = (num & 0x7f) | 0x80;
    bytes.push(byte);
    num >>>= 7;
  }
  bytes.push(num & 0xff);

  return new Uint8Array(bytes);
}

function uint8BeToBigInt(buffer: Uint8Array, offset: number, size: number): bigint {
  if (size < 1 || size > 8) {
    throw new Error('Invalid size');
  }

  let num = 0n;
  for (let i = 0; i < size; i++) {
    num = num << 8n;
    num = num | BigInt(buffer[offset + i]);
  }

  return num;
}

/**
 * Decode a Base58 string to bytes
 * Block-based approach that matches the C++ implementation in pastella-core
 */
function base58Decode(input: string): Uint8Array {
  const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const FULL_BLOCK_SIZE = 8;
  const FULL_ENCODED_BLOCK_SIZE = 11;

  // Build decoded_block_sizes lookup: maps encoded size → decoded size
  const DECODED_BLOCK_SIZES: Record<number, number> = {};
  for (let i = 0; i <= FULL_BLOCK_SIZE; i++) {
    DECODED_BLOCK_SIZES[ENCODED_BLOCK_SIZES[i]] = i;
  }

  if (input.length === 0) {
    return new Uint8Array(0);
  }

  const fullBlockCount = Math.floor(input.length / FULL_ENCODED_BLOCK_SIZE);
  const lastBlockSize = input.length % FULL_ENCODED_BLOCK_SIZE;

  // Calculate total decoded size
  let totalDecodedSize = fullBlockCount * FULL_BLOCK_SIZE;
  if (lastBlockSize > 0) {
    const lastDecodedSize = DECODED_BLOCK_SIZES[lastBlockSize];
    if (lastDecodedSize === undefined) {
      throw new Error(`Invalid Base58 input length (partial block size ${lastBlockSize} not valid)`);
    }
    totalDecodedSize += lastDecodedSize;
  }

  const result = new Uint8Array(totalDecodedSize);
  let offset = 0;

  // Decode full blocks (11 chars → 8 bytes)
  for (let i = 0; i < fullBlockCount; i++) {
    const blockStart = i * FULL_ENCODED_BLOCK_SIZE;
    const block = input.slice(blockStart, blockStart + FULL_ENCODED_BLOCK_SIZE);

    // Convert block from Base58 (process right to left like C++ implementation)
    let num = 0n;
    let order = 1n;
    for (let j = block.length - 1; j >= 0; j--) {
      const digit = BigInt(BASE58_MAP[block[j]]);
      num = num + (order * digit);
      order = order * 58n;
    }

    // Convert to bytes (big-endian)
    for (let j = FULL_BLOCK_SIZE - 1; j >= 0; j--) {
      result[offset + j] = Number(num & 0xffn);
      num = num >> 8n;
    }

    offset += FULL_BLOCK_SIZE;
  }

  // Decode last partial block
  if (lastBlockSize > 0) {
    const blockStart = fullBlockCount * FULL_ENCODED_BLOCK_SIZE;
    const block = input.slice(blockStart);
    const decodedSize = DECODED_BLOCK_SIZES[lastBlockSize];

    // Convert block from Base58 (process right to left)
    let num = 0n;
    let order = 1n;
    for (let j = block.length - 1; j >= 0; j--) {
      const digit = BigInt(BASE58_MAP[block[j]]);
      num = num + (order * digit);
      order = order * 58n;
    }

    // Convert to bytes (big-endian)
    for (let j = decodedSize - 1; j >= 0; j--) {
      result[offset + j] = Number(num & 0xffn);
      num = num >> 8n;
    }
  }

  return result;
}

function base58Encode(buffer: Uint8Array): string {
  const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const FULL_BLOCK_SIZE = 8;
  const FULL_ENCODED_BLOCK_SIZE = 11;

  if (buffer.length === 0) {
    return '';
  }

  const fullBlockCount = Math.floor(buffer.length / FULL_BLOCK_SIZE);
  const lastBlockSize = buffer.length % FULL_BLOCK_SIZE;

  const resultSize = fullBlockCount * FULL_ENCODED_BLOCK_SIZE + ENCODED_BLOCK_SIZES[lastBlockSize];
  let result = new Array(resultSize).fill(BASE58_ALPHABET[0]);

  for (let i = 0; i < fullBlockCount; i++) {
    const blockStart = i * FULL_BLOCK_SIZE;
    const resultStart = i * FULL_ENCODED_BLOCK_SIZE;

    let num = uint8BeToBigInt(buffer, blockStart, FULL_BLOCK_SIZE);

    let j = ENCODED_BLOCK_SIZES[FULL_BLOCK_SIZE] - 1;
    while (num > 0n) {
      const remainder = num % 58n;
      num = num / 58n;
      result[resultStart + j] = BASE58_ALPHABET[Number(remainder)];
      j--;
    }
  }

  if (lastBlockSize > 0) {
    const blockStart = fullBlockCount * FULL_BLOCK_SIZE;
    const resultStart = fullBlockCount * FULL_ENCODED_BLOCK_SIZE;

    let num = uint8BeToBigInt(buffer, blockStart, lastBlockSize);

    let j = ENCODED_BLOCK_SIZES[lastBlockSize] - 1;
    while (num > 0n) {
      const remainder = num % 58n;
      num = num / 58n;
      result[resultStart + j] = BASE58_ALPHABET[Number(remainder)];
      j--;
    }
  }

  return result.join('');
}

function generateEd25519Keypair(privateKeyBytes: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array } {
  let scalarBigInt = 0n;
  for (let i = 0; i < 32; i++) {
    scalarBigInt |= BigInt(privateKeyBytes[i]) << (BigInt(i) * 8n);
  }

  const curveOrder = 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn;
  let scalarToUse = scalarBigInt;

  if (scalarBigInt >= curveOrder) {
    scalarToUse = scalarBigInt % curveOrder;
  }

  const point = Ed25519.Point.BASE.multiply(scalarToUse);

  // Manually extract the 32-byte x-coordinate (not the compressed 33-byte format)
  // The point object should have x and y coordinates as BigInt arrays
  const rawBytes = point.toRawBytes();

  let publicKeyBytes = rawBytes;

  // Double-check we got exactly 32 bytes
  if (publicKeyBytes.length !== 32) {
    // Force truncate to 32 bytes if needed
    publicKeyBytes = publicKeyBytes.slice(0, 32);
  }

  return {
    publicKey: new Uint8Array(publicKeyBytes),
    privateKey: new Uint8Array(privateKeyBytes)
  };
}

function publicKeyToAddress(publicKeyBytes: Uint8Array): string {
  const prefixBytes = encodeVarint(WALLET_ADDRESS_PREFIX);

  const buffer = new Uint8Array(prefixBytes.length + publicKeyBytes.length);
  buffer.set(prefixBytes, 0);
  buffer.set(publicKeyBytes, prefixBytes.length);

  const hashHex = keccak256(buffer);
  const hashBytes = hexToBytes(hashHex);

  const checksum = hashBytes.slice(0, 4);

  const finalBuffer = new Uint8Array(buffer.length + 4);
  finalBuffer.set(buffer, 0);
  finalBuffer.set(checksum, buffer.length);

  return base58Encode(finalBuffer);
}

// ============================================================================
// EXPORTED WALLET CLASS
// ============================================================================
export class PastellaWallet {
  static async generateWallet(): Promise<{ mnemonic: string; address: string }> {
    // Generate 24 random words
    const words: string[] = [];
    for (let i = 0; i < 24; i++) {
      const randomIndex = Math.floor(Math.random() * WORDLIST.length);
      words.push(WORDLIST[randomIndex]);
    }

    // Calculate checksum word
    const checksumWord = calculateChecksumWord(words);

    // Combine to create 25-word mnemonic
    const mnemonic = [...words, checksumWord].join(' ');

    // Generate address from mnemonic
    const privateKeyBytes = mnemonicToPrivateKey(mnemonic);
    const keypair = generateEd25519Keypair(privateKeyBytes);
    const address = publicKeyToAddress(keypair.publicKey);

    return {
      mnemonic,
      address
    };
  }

  static async importFromMnemonic(mnemonic: string): Promise<{ address: string }> {
    if (!verifyMnemonicChecksum(mnemonic)) {
      throw new Error('Invalid mnemonic checksum');
    }

    const privateKeyBytes = mnemonicToPrivateKey(mnemonic);
    const keypair = generateEd25519Keypair(privateKeyBytes);
    const address = publicKeyToAddress(keypair.publicKey);

    return {
      address
    };
  }

  static async importFromPrivateKey(privateKeyHex: string): Promise<{ address: string }> {
    // Remove 0x prefix if present
    const hexKey = privateKeyHex.replace(/^0x/i, '');

    // Validate hex length (must be 64 characters for Ed25519)
    if (hexKey.length !== 64) {
      throw new Error('Private key must be 64 hex characters');
    }

    // Validate hex format
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (!hexRegex.test(hexKey)) {
      throw new Error('Invalid hex format');
    }

    // Convert hex to bytes
    const privateKeyBytes = hexToBytes(hexKey);

    // Generate keypair and address
    const keypair = generateEd25519Keypair(privateKeyBytes);
    const address = publicKeyToAddress(keypair.publicKey);

    return {
      address
    };
  }
}

// ============================================================================
// PUBLIC KEY DERIVATION HELPER
// ============================================================================

/**
 * Convert a hex string public key to a readable address
 */
export function publicKeyHexToAddress(publicKeyHex: string): string {
  const publicKeyBytes = hexToBytes(publicKeyHex);
  return publicKeyToAddress(publicKeyBytes);
}

/**
 * Derive the public spend key from a mnemonic phrase
 * Returns the public key as a hex string for wallet sync
 */
export function derivePublicKeyFromMnemonic(mnemonic: string): string {
  if (!verifyMnemonicChecksum(mnemonic)) {
    throw new Error('Invalid mnemonic checksum');
  }

  const privateKeyBytes = mnemonicToPrivateKey(mnemonic);
  const keypair = generateEd25519Keypair(privateKeyBytes);

  // Convert public key bytes to hex string
  return Array.from(keypair.publicKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive the private key from a mnemonic phrase
 * Returns the private key as a hex string for signing transactions
 */
export function derivePrivateKeyFromMnemonic(mnemonic: string): string {
  if (!verifyMnemonicChecksum(mnemonic)) {
    throw new Error('Invalid mnemonic checksum');
  }

  const privateKeyBytes = mnemonicToPrivateKey(mnemonic);

  // Convert private key bytes to hex string
  return Array.from(privateKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive the public key from a private key hex string
 * Returns the public key as a hex string for wallet sync
 */
export function derivePublicKeyFromPrivateKey(privateKeyHex: string): string {
  // Remove 0x prefix if present
  const hexKey = privateKeyHex.replace(/^0x/i, '');

  // Validate hex length
  if (hexKey.length !== 64) {
    throw new Error('Private key must be 64 hex characters');
  }

  // Validate hex format
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(hexKey)) {
    throw new Error('Invalid hex format');
  }

  // Convert hex to bytes
  const privateKeyBytes = hexToBytes(hexKey);

  // Generate keypair
  const keypair = generateEd25519Keypair(privateKeyBytes);

  // Convert public key bytes to hex string
  return Array.from(keypair.publicKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive both public and private keys from a mnemonic phrase
 * Returns both keys as hex strings for transaction signing
 */
export function deriveKeysFromMnemonic(mnemonic: string): { publicKey: string; privateKey: string } {
  if (!verifyMnemonicChecksum(mnemonic)) {
    throw new Error('Invalid mnemonic checksum');
  }

  const privateKeyBytes = mnemonicToPrivateKey(mnemonic);
  const keypair = generateEd25519Keypair(privateKeyBytes);

  // Convert both keys to hex strings
  const publicKeyHex = Array.from(keypair.publicKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const privateKeyHex = Array.from(keypair.privateKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    publicKey: publicKeyHex,
    privateKey: privateKeyHex
  };
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

/**
 * Helper to convert atomic units to human-readable format
 * @param atomic - Amount in atomic units
 * @returns Formatted string with ticker
 */
export function formatAtomic(atomic: number): string {
  const coins = atomic / Math.pow(10, DECIMALS);
  return `${coins.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: DECIMALS })} ${TICKER}`;
}

/**
 * Helper to convert human-readable amount to atomic units
 * @param coins - Amount in coins
 * @returns Amount in atomic units
 */
export function coinsToAtomic(coins: number): number {
  return Math.floor(coins * Math.pow(10, DECIMALS));
}

/**
 * Helper to convert atomic units to coins
 * @param atomic - Amount in atomic units
 * @returns Amount in coins
 */
export function atomicToCoins(atomic: number): number {
  return atomic / Math.pow(10, DECIMALS);
}

// ============================================================================
// EXPORT API AND SYNC MODULES
// ============================================================================
export { DaemonApi } from './api';
export { WalletSync, WalletSyncConfig } from './walletSync';
export { Wallet } from './Wallet';
export * from './types';
export * from './transaction';
export * from './config';
export * from './staking';

// Export Base58 functions
export { base58Encode, base58Decode };
