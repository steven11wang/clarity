// Answer explanations for CookSAT Mock Exam 2, keyed by module id and question
// number. `summary` is the one-paragraph reasoning for the item; `choices`
// carries one line per letter - why the key is right, why each distractor is
// wrong. build-practice-exam.mjs folds these into the exam JSON and fails the
// build if a question is missing one.

export const EXPLANATIONS = {
  'module-1': {
    1: {
      summary:
        'Every verb around the blank describes physically marking wood: she scratches initials with nails, burns patterns into cutting boards, and puts her maker’s mark on signs "in dark ink." The blank needs a word for pressing a mark into a surface.',
      choices: {
        A: 'This is the "stamp of approval" sense - giving official permission. She is decorating wood, not authorizing anything.',
        B: 'Correct. To imprint is to press a mark onto a surface, which is exactly what applying a maker’s mark in dark ink does, and it matches the scratching and burning alongside it.',
        C: 'This is the foot sense of stamping. You cannot stomp a mark in ink onto a wooden sign.',
        D: 'This is the "stamp out" sense - wiping something out. She is adding a mark, not removing one.',
      },
    },
    2: {
      summary:
        'The sentence says Art Nouveau elements "have been reproduced throughout the city," and the Old England Building is offered as an example. The blank has to mean repeating or mirroring Horta’s style.',
      choices: {
        A: 'Restoring means bringing back something lost or damaged. Horta’s style was never lost, and a separate building could not restore it.',
        B: 'Obscuring hides something. That contradicts "reproduced throughout the city," which says the style is visible in other buildings.',
        C: 'Correct. To echo a style is to repeat it in a new place, which is what reproducing Horta’s innovations in a later building does.',
        D: 'Contradicting is the opposite of reproducing. The example is offered to show continuity, not conflict.',
      },
    },
    3: {
      summary:
        'The "because" clause explains why the blank is difficult: algae grow rapidly, cover surfaces fast, and are hard to eliminate. That is a reason it is hard to hold their growth back.',
      choices: {
        A: 'Correct. Curbing means holding back or limiting, and rapid growth that is hard to eliminate is exactly what makes limiting algae difficult.',
        B: 'Algae that grow rapidly and cover surfaces are easier to see, not harder. Fast spread gives no reason that observing would be difficult.',
        C: 'You drain water, not growth. The phrase "draining the growth of algae" does not describe anything the passage discusses.',
        D: 'Same problem as observing: algae spreading quickly across visible surfaces would make recording easier, not difficult.',
      },
    },
    4: {
      summary:
        'The flying buttress is "almost always included" in Gothic cathedrals, and even mixed-style cathedrals include "several of these standard features." The blank needs a word for a defining, identifying feature.',
      choices: {
        A: 'Tempting because a buttress is structural, but the text defines it as an external support, not a base, and the point being made is that it identifies the style.',
        B: 'An anomaly is a rare exception. The text says the opposite - the feature is almost always present.',
        C: 'Correct. A hallmark is a characteristic feature that identifies something, which matches "almost always included" and "standard features."',
        D: 'The sentence stresses what stays the same across cathedrals. A variation would emphasize difference.',
      },
    },
    5: {
      summary:
        'The underlined portion defines synaptic pruning - neural connections being selectively eliminated during development. Everything after it (Tanaka, Nakamura, Yamamoto and Thompson) is about that process, so the definition sets up the discussion.',
      choices: {
        A: 'It is a definition, not a set of examples. The studies that came before Yamamoto and Thompson are described in the sentences after it.',
        B: 'Correct. It gives a plain description of synaptic pruning, the process every study in the text investigates.',
        C: 'Nothing suggests the definition of pruning was unclear in those studies. What the text calls poorly understood is the relative prevalence of the two mechanisms.',
        D: 'Synaptic pruning is a biological process in the brain, not a method scientists use to analyze data.',
      },
    },
    6: {
      summary:
        'Track the three moves in order: two Nahuatl words (calli, calmecac), then the name and definition of the pattern they illustrate (absolutive marking), then the closing claim that Nahuatl has many such examples.',
      choices: {
        A: 'No other language is discussed, and the text never raises or answers a question.',
        B: 'Correct. Specific words come first, the general phenomenon they exemplify comes second, and the frequency claim closes the text.',
        C: 'The text never says these are the most frequent Nahuatl words, and translation into Spanish is never mentioned.',
        D: 'No controversy appears anywhere in the text, so nothing is being resolved.',
      },
    },
    7: {
      summary:
        'Text 1 reports one explanation - deliberate human construction - and lists the features supporting it. Text 2 takes up two natural explanations, coastal erosion and tectonic fracturing, and weighs each against Apollonia.',
      choices: {
        A: 'Text 2 is the more clinical of the two; it conveys no excitement, and neither text is written to dramatize the discovery.',
        B: 'Correct. Text 1 sticks to a single cause, human construction; Text 2 evaluates erosion and tectonic fracturing in turn.',
        C: 'Reversed. Text 1 lists features Apollonia has, and Text 2 points to the breakwater as a feature natural formations lack.',
        D: 'Text 2 rules out the natural explanations, which supports human construction rather than arguing against it.',
      },
    },
    8: {
      summary:
        'The last sentence answers the question directly: Sophia hoped "not only to meet me but to have the chance to meet the renowned pianist himself" - the narrator and the narrator’s father.',
      choices: {
        A: 'The mastery detail belongs to the narrator, who had learned all Katherine could teach. Nothing says Sophia wants lessons from the narrator.',
        B: 'Sophia is called an aspiring composer, but the text never says she lacks formal instruction or wants James Cole as a mentor - only that she hoped to meet him.',
        C: 'Sophia performing her compositions is never mentioned, and neither is feedback.',
        D: 'Correct. She came hoping to be introduced to the narrator and to the narrator’s father.',
      },
    },
    9: {
      summary:
        'Mendoza emulated Vargas’s stream improvisation, and the text ties that technique to the syncopated spontaneity "now synonymous with the group’s shared aesthetic." Castillo is the named contrast, with more structured melodic development.',
      choices: {
        A: 'The text says Mendoza emulated the technique. Claiming his work is less derivative than people acknowledge reverses that.',
        B: 'Correct. Because Mendoza used the technique tied to the Collective’s signature spontaneity, his performances would carry those typical qualities more than Castillo’s structured playing does.',
        C: 'The text ranks nothing. Calling Mendoza’s work inferior is a judgment it never makes.',
        D: '"More aesthetically interesting" is the same problem - a value judgment the passage does not support.',
      },
    },
    10: {
      summary:
        'The author’s point is that no single factor in isolation explains a city’s cycling habits. Infrastructure is introduced as the example of a feature you cannot simply copy, so the author treats it as one contributor among many.',
      choices: {
        A: 'The text never claims cycling infrastructure lowers cycling rates anywhere. It says copying one feature will not by itself raise them.',
        B: 'Correct. Infrastructure is one of several factors - alongside topography and weather - that shape cycling activity.',
        C: 'The author refuses to rank the factors; the argument is that none of them alone explains the pattern.',
        D: 'Nothing in the text reverses cause and effect by making infrastructure a product of high cycling rates.',
      },
    },
    11: {
      summary:
        'The conclusion is narrow: California had more damaging parasite species than either other region. Support has to compare parasite counts across all three regions - California 315, Massachusetts 54, Florida 21.',
      choices: {
        A: 'Correct. It gives California’s 315 parasite species and states it exceeds both other regions, which is precisely the conclusion.',
        B: 'It compares a parasite count to a predator count. Predator numbers say nothing about which region had more parasites.',
        C: 'Both figures are Florida’s, and they compare parasites to predators within one region rather than across regions.',
        D: 'These are predator counts. The conclusion is about parasites.',
      },
    },
    12: {
      summary:
        'The claim has two parts: philosophers debating abstract ideals in distant academies, and ignoring concrete hardship close to home. The quotation has to show both.',
      choices: {
        A: 'It warns that actions will be judged. There is no distant academy and no local hardship being ignored.',
        B: 'This praises the nation and knowledge. It contains no criticism at all.',
        C: 'Correct. "Truths from distant halls" is the remote debate, and the poor starving "in the shadows of your walls" is the ignored hardship nearby.',
        D: 'This is about the poet’s own mission to reach the masses, not about philosophers overlooking suffering.',
      },
    },
    13: {
      summary:
        'The example is about the Cascade variety, so read only the Cascade bars: about 150 pairs with striped petals and about 60 with solid. That also fits the claim that striped is more common.',
      choices: {
        A: '650 is the Alpine bar, and Alpine shows roughly 200 solid pairs, so "no pairs" is wrong twice over.',
        B: '110 and about 49 are the Sunset bars. The example specifies the Cascade variety.',
        C: 'Correct. Cascade shows about 150 striped pairs and about 60 solid pairs, more striped than solid, as the sentence claims.',
        D: '110 is Sunset’s striped bar, and no variety in the graph shows zero solid pairs.',
      },
    },
    14: {
      summary:
        'The conclusion is that invasives benefit more than natives from earlier spring warming. Support needs the invasive N. melanostomus to gain more than the native M. dolomieu when spring comes early.',
      choices: {
        A: 'Both species produced more offspring, so nothing separates them - and the extended summer growing season is a second possible cause, which weakens the link to spring timing.',
        B: 'If neither species shifted its spawning despite temperature variation, the finding supports no advantage for either.',
        C: 'The invasive spawning later than the native in early-warming years points away from an invasive advantage.',
        D: 'Correct. Both advance, but the invasive advances much more, which is exactly the relative benefit the researchers concluded.',
      },
    },
    15: {
      summary:
        'The finding is about retention: peer-referred participants stayed in the study at a much higher rate. The completion has to explain why a peer relationship would keep someone participating.',
      choices: {
        A: 'Whether two people in a shared network see each other as peers or professional acquaintances says nothing about why retention rose.',
        B: 'This is about who gets recruited in the first place, not about who stays once recruited.',
        C: 'The study worked only with counties with aging populations. Younger participants were never compared.',
        D: 'Correct. A sense of commitment created by the peer relationship explains why those participants kept going.',
      },
    },
    16: {
      summary:
        '"Currently" pins the sentence to the present, and the second clause ("where visitors can observe") is present tense too. The verb has to be simple present.',
      choices: {
        A: 'Correct. The simple present matches "Currently" and the present-tense clause that follows.',
        B: 'The future perfect places the action before some later point in the future, which clashes with "Currently."',
        C: 'The simple past puts the sculpture there in the past, contradicting "Currently."',
        D: 'The past progressive is also past tense, so it conflicts with "Currently" in the same way.',
      },
    },
    17: {
      summary:
        'Strip out the nonessential clause "which is positioned at the root apex" and the sentence reads "The root cap ______ responsibility." It has no other verb, so the blank must be a finite present-tense verb agreeing with the singular subject.',
      choices: {
        A: 'A bare participle cannot serve as the main verb, so the sentence would have no complete predicate.',
        B: 'An infinitive cannot be the main verb of the sentence either.',
        C: 'Correct. "Bears" is a finite present-tense verb that agrees with the singular subject "root cap."',
        D: 'A perfect participle is another non-finite form, leaving the sentence a fragment.',
      },
    },
    18: {
      summary:
        'The subject "California resident Julia Morgan" is followed by a long nonessential description. Once that is removed, the sentence still needs a main verb: Morgan ______ her practice in 1904.',
      choices: {
        A: 'Correct. "Began" is a finite past-tense verb, giving the subject its predicate.',
        B: 'A perfect participle cannot be the main verb, so the sentence never finishes.',
        C: 'A present participle leaves the sentence a fragment with no finite verb.',
        D: 'An infinitive cannot serve as the main verb here either.',
      },
    },
    19: {
      summary:
        '"With nearly five millennia of atmospheric data in its tree rings" is an introductory phrase, not a clause - it has no subject or verb of its own. The only mark that can join it to the main clause is a comma.',
      choices: {
        A: 'A period leaves the introductory phrase standing alone as a fragment.',
        B: 'A semicolon needs an independent clause on both sides, and the first part is not one.',
        C: '"And" joins grammatically equal parts. The first part is a phrase, not a clause, so there is nothing to coordinate.',
        D: 'Correct. A comma is the standard mark after an introductory modifying phrase.',
      },
    },
    20: {
      summary:
        '"The student discovered research profiles of two other astronomers who worked at the observatory" is a complete sentence, and the two names that follow spell out who those astronomers are. A complete clause introducing a list takes a colon.',
      choices: {
        A: 'Correct. The colon introduces the list of two astronomers after a complete clause.',
        B: 'A semicolon requires an independent clause after it, and a list of two names is not one.',
        C: 'A period does the same damage: the names become a fragment.',
        D: 'With no punctuation the names run straight into the sentence, and the boundary between the clause and the list disappears.',
      },
    },
    21: {
      summary:
        'The first sentence says the pseudonym "accomplished far more than simply concealing her authorship." The second sentence confirms and sharpens that claim by spelling out the rhetorical strategy. That calls for a transition of emphasis.',
      choices: {
        A: '"However" signals contrast. The second sentence agrees with the first rather than pushing against it.',
        B: '"Conversely" sets up an opposite case, and no opposite is offered.',
        C: '"In addition" would introduce a separate additional point. This sentence restates and intensifies the same point.',
        D: 'Correct. "Indeed" confirms and strengthens the claim just made.',
      },
    },
    22: {
      summary:
        'The dash-enclosed material walks through what Carson observes: first beauty, then cruelty. The sentence after the blank states what all of it finally amounts to for Carson, so the transition has to signal a closing upshot.',
      choices: {
        A: '"Hence" marks a logical consequence of a stated cause, but the earlier material describes observations rather than a premise leading to this result.',
        B: '"To that end" introduces a means to a stated goal, and no goal has been set out.',
        C: 'Correct. "Ultimately" presents the final conclusion Carson reaches after grappling with the contradictions.',
        D: '"Moreover" adds another item to a list, but this sentence closes the discussion rather than extending it.',
      },
    },
    23: {
      summary:
        'The goal is a similarity. The only fact the notes give about both butterflies is that each can be found in the San Bernardino Mountains - their wingspans differ sharply.',
      choices: {
        A: 'This puts the two wingspans side by side, which emphasizes the difference between them.',
        B: 'Only the Pygmy Blue appears, so no comparison is made at all.',
        C: 'Only the Monarch is named, and "several insect species" adds nothing from the notes about the Pygmy Blue.',
        D: 'Correct. It states the one trait the notes give both species: both are found in the San Bernardino Mountains.',
      },
    },
    24: {
      summary:
        'The goal is to emphasize milk’s pH. The strongest choice states milk’s value and places it against the other two substances so the reader sees where 6 sits on the scale.',
      choices: {
        A: 'Correct. It gives milk’s pH of about 6 and locates it between lemon juice at 2 and baking soda at 9.',
        B: 'Milk never appears, so it cannot emphasize milk’s pH.',
        C: 'This says the three can be ordered without giving a single value, so milk gets no emphasis.',
        D: 'The focus lands on the baking soda solution, with milk mentioned only in passing.',
      },
    },
    25: {
      summary:
        'The goal is narrow: identify the title of the first published symphony. The correct choice has to name it.',
      choices: {
        A: 'This gives the year of publication and never names the work.',
        B: 'This says the first publication was a symphony but leaves the title out.',
        C: 'This names the journal and the year, not the symphony.',
        D: 'Correct. It names "Symphony in E Minor" as Price’s first published symphony.',
      },
    },
    26: {
      summary:
        'The goal is a similarity. The notes describe the foot positions as different, so the shared trait is the higher-level one: both are named stances for the practitioner’s feet.',
      choices: {
        A: '"In contrast to" makes this an explicit statement of difference, the opposite of the goal.',
        B: 'This is factually wrong per the notes: zenkutsu-dachi is a Shotokan karate stance, not a Taekwondo one.',
        C: 'Correct. It names both stances and the trait they share - each is a stance for the practitioner’s feet.',
        D: 'Only one stance is mentioned, so there is no comparison.',
      },
    },
    27: {
      summary:
        'The goal is to connect Fractured Memory to the history of photomontage in art specifically. The notes say photomontage became established with artists in the 1960s and is still widely used, so the work joins that artistic lineage.',
      choices: {
        A: 'Correct. It places Khoury’s 2021 work in the line of artists who have made photomontage an established medium since the 1960s.',
        B: 'The Hassan quotation is about how photomontages are assembled, which is technique, not the work’s place in art history.',
        C: 'This summarizes the history but never mentions Fractured Memory, so no connection is made.',
        D: 'It contradicts the notes: artistic use has grown since the 1960s and continues today; only commercial use declined.',
      },
    },
  },
  'module-2': {
    1: {
      summary:
        'The sentence concedes Murphy accomplished much, then says that for a lasting place in memory there is little that can ______ being first. The example about the first solo crossing shows that being first outranks everything else.',
      choices: {
        A: 'Correct. To prevail over something is to outweigh or surpass it, which is what nothing else can do to being first.',
        B: 'Nothing in the sentence varies or rises and falls, so fluctuation does not fit.',
        C: 'Constraining is about limiting something, not about ranking one accomplishment above another.',
        D: 'Overreaching means extending beyond proper limits; it does not express surpassing.',
      },
    },
    2: {
      summary:
        'The shortcoming is the narrow focus on the temperate Northern Hemisphere, caused by sparse monitoring. Getting new tropical and polar data is what fixes that gap, so the blank means "improve."',
      choices: {
        A: 'Extrapolating extends findings to new cases. A shortcoming is not something you extend.',
        B: 'Corroborating means confirming. The new data corrected the narrow coverage rather than confirming the flaw.',
        C: 'Correct. To ameliorate is to remedy or improve, which is what broader regional data did to the narrow focus.',
        D: 'Overlooking is ignoring, the opposite of what gaining new data accomplishes.',
      },
    },
    3: {
      summary:
        'The colon explains the counterintuitive effect: buyers "who hadn’t previously wanted to purchase old cards flooded the market." Rising prices created demand that did not exist before.',
      choices: {
        A: 'Meeting demand means satisfying demand that already exists. The text says new buyers appeared.',
        B: 'Leveraging uses existing demand for advantage. Here the price rise generated the demand.',
        C: 'Correct. To elicit demand is to draw it out, which matches previously uninterested buyers entering the market.',
        D: 'Exploiting also presupposes demand that is already there to take advantage of.',
      },
    },
    4: {
      summary:
        'The dash clause spells out the meaning: other marine biologists "clearly find his studies valuable." Frequent citation therefore emphasizes the importance of his work.',
      choices: {
        A: 'Diminishing weakens. Frequent citation by peers does the opposite.',
        B: 'Contradicting would set the citation record against the importance of his work, but the two agree.',
        C: 'Obscuring hides something. Being widely referenced makes the work’s value more visible.',
        D: 'Correct. To underscore is to emphasize, which matches peers clearly finding the work valuable.',
      },
    },
    5: {
      summary:
        'The underlined observation - pressure increases in the water around the bamboo, not just inside it - is what the prototype device is built on. The last sentence describes that device, so the observation is the finding the application rests on.',
      choices: {
        A: 'The claim made earlier is about pressure inside the plant. An increase in the surrounding water is a different, external result.',
        B: 'Correct. The finding about the surrounding water is what leads directly to the pressure regulation device described next.',
        C: 'It is not tangential - it is the basis of the prototype - and the prototype demonstrates the effect rather than explaining it.',
        D: 'The observation came out of the research rather than preceding it as a motivation.',
      },
    },
    6: {
      summary:
        'Indonesia’s shift away from untreated water is presented as the kind of change "often explained by appeal to the health transition hypothesis." The rest of the text uses Sullivan’s Kenya study to call that explanation reductive.',
      choices: {
        A: 'The text does not fault the Indonesian trend as unsuited for testing the model; it faults the model itself.',
        B: 'Only one explanation is offered and then criticized - the text never presents two equally compelling ones.',
        C: 'Correct. Indonesia illustrates the type of shift the hypothesis is frequently used to explain and, per Sullivan, explains inadequately.',
        D: 'Kenya is a study of heterogeneous water sourcing, not a separate trend that shares a cause with Indonesia’s.',
      },
    },
    7: {
      summary:
        'Ankara residents used libraries far more than Oslo residents did, yet fewer Ankara respondents lived within a 15-minute walk of one. The text uses that to rule out proximity as the explanation.',
      choices: {
        A: 'No expectations of the researchers are described anywhere in the text.',
        B: 'Correct. Since proximity alone cannot explain the gap, something else must account for it.',
        C: 'The text never questions the accuracy of the survey results.',
        D: 'Nothing suggests the figures came from sources predating the survey.',
      },
    },
    8: {
      summary:
        'The conclusion is that D. rerio associates the P. promelas pheromone specifically with danger. Support has to rule out the fish reacting to the act of adding water at all.',
      choices: {
        A: 'Correct. Control water from a fishless tank producing no reaction shows the response is to the pheromone, not the disturbance of introducing a sample.',
        B: 'How other species behave says nothing about what D. rerio associates with danger.',
        C: 'Little or no response to most samples undercuts the conclusion rather than supporting it.',
        D: 'Reacting before samples were introduced suggests the researchers’ approach, not the pheromone, triggered the behavior.',
      },
    },
    9: {
      summary:
        'The research question is whether perceived compatibility between the two technology categories predicts brand-extension purchases. The team already computed the change in purchase probability for each pair, so the missing piece is a compatibility rating for each pair to correlate against it.',
      choices: {
        A: 'Brand recognition and product cost are neither of the two variables in the research question.',
        B: 'Close, but it rates a product against others in the same category. The question is about compatibility between the two categories in the pair.',
        C: 'Brand recognition again, and correlating it with a different group’s purchases abandons the calculated probability change.',
        D: 'Correct. Rate the compatibility of the two categories in each pair, then correlate those ratings with the probability change already calculated.',
      },
    },
    10: {
      summary:
        'S1 rated the two session types equally, but the model did not: the graph puts the model’s project-based prediction well above 4 and its lecture-based prediction below 3.',
      choices: {
        A: 'Correct. The model predicted a markedly higher engagement rating for project-based than for lecture-based sessions.',
        B: 'Equal ratings are what S1 reported. The graph shows the model predicting two clearly different values.',
        C: 'Reversed - the lecture-based bar is the shorter of the two.',
        D: 'The project-based prediction sits above 4 on a 5-point scale, which is high engagement, not slight.',
      },
    },
    11: {
      summary:
        'The categories, including "ceremonial narratives," were Lindqvist’s. The text stresses that the Ojibwe are not known to have drawn such distinctions before his work, so there is no basis for assuming the elders shared his view.',
      choices: {
        A: 'The narratives never shared are outside the evidence entirely; nothing supports a claim about how they would have been classified.',
        B: 'Correct. Since these categorical distinctions were not applied by Ojibwe people before Lindqvist, there is no reason to think the elders would have treated seasonal detail as marking a different kind of narrative.',
        C: 'The text credits the categories to Lindqvist and raises no question about Mwangi shaping them.',
        D: 'Whether the seasonal details were accurate descriptions of natural cycles is never at issue.',
      },
    },
    12: {
      summary:
        'The New Zealand study is the outlier: European studies found the negative association, the Kenya study matched them, and few studies match Sullivan and O’Brien. The weight of evidence says the association is general.',
      choices: {
        A: 'The text gives no absolute temperature or oxygen levels for New Zealand or anywhere else.',
        B: 'The evidence points the other way - non-European studies keep reproducing the association.',
        C: 'Nothing suggests Kariuki’s measurements were flawed, and that study agrees with many others.',
        D: 'Correct. The association shows up across regions, so temperature and dissolved oxygen do typically vary inversely.',
      },
    },
    13: {
      summary:
        'Being shielded from the water column during transmission should have protected the two-host CLPs as pH fell. Their abundance dropped anyway, while exposed directly transmitted parasites held steady - so other pH-driven effects outweighed that protection.',
      choices: {
        A: 'The data contradict this: the parasites with two hosts are the ones whose abundance fell as pH declined.',
        B: 'This reverses the passage. CLPs are the shielded ones; directly transmitted parasites are exposed to external conditions.',
        C: 'The study did not compare CLP transmission strategies against one another, and host dependence was not measured.',
        D: 'Correct. Whatever advantage the shielded route offered was not enough to offset the other pH-driven effects on CLP abundance.',
      },
    },
    14: {
      summary:
        'Insect studies averaged larger differences than mammal studies, but every class had individual studies above the insect average. So some mammal studies must have found larger effects than some insect studies did.',
      choices: {
        A: 'Whether studies specified that effects were detrimental is never discussed.',
        B: 'Correct. Individual mammal studies exceeding the insect average must exceed the insect studies that fall below it.',
        C: 'The text never compares Foster’s result to the average for luna moth studies.',
        D: 'Reversed - on average, insect studies showed the larger differences.',
      },
    },
    15: {
      summary:
        'The blank needs a possessive referring to the singular title On the Origin of Species, which owns the "groundbreaking insights."',
      choices: {
        A: '"They’re" means "they are," which is a contraction, not a possessive, and the antecedent is singular.',
        B: 'Correct. "Its" is the singular possessive matching the singular title.',
        C: '"Their" is plural, but the antecedent - one book - is singular.',
        D: '"It’s" means "it is," which cannot show possession of the insights.',
      },
    },
    16: {
      summary:
        '"The migration at Lake Erie in Ohio is a more unusual pattern, though" and "abundant food sources and mild winter conditions prompt some birds to depart several weeks earlier" are both complete sentences. Two independent clauses need a mark strong enough to separate them.',
      choices: {
        A: 'Correct. "Though" closes the first clause and the semicolon joins the two independent clauses.',
        B: 'With the colon before "though," the second half becomes a subordinate clause and the sentence never delivers the complete thought the colon promises.',
        C: 'Commas around "though" leave two independent clauses joined by a comma - a comma splice.',
        D: 'Also a comma splice: a comma alone cannot join two independent clauses.',
      },
    },
    17: {
      summary:
        'Everything before the blank is a complete sentence, and what follows is the list of the three signature elements it announces. A complete clause introducing a list takes a colon - especially here, where the items already contain internal commas and are separated by semicolons.',
      choices: {
        A: 'A period cuts the list loose from the clause that introduces it, leaving a fragment.',
        B: 'A comma is too weak to introduce a list this long, and the items are already separated by semicolons.',
        C: 'A semicolon needs an independent clause after it; the list is not one, and semicolons are already doing the work of dividing the three items.',
        D: 'Correct. The colon follows a complete clause and introduces the three elements it promised.',
      },
    },
    18: {
      summary:
        'Cut the nonessential clause "whose research focuses on memory retrieval" and the subject is "cognitive psychologists such as Bergman" - plural. The verb has to be plural too.',
      choices: {
        A: 'Correct. "Argue" agrees with the plural subject "cognitive psychologists."',
        B: '"Argues" is singular; it agrees with Bergman rather than with the plural subject of the clause.',
        C: '"Is arguing" is also singular and mismatches the plural subject.',
        D: '"Has argued" is singular as well, so the subject-verb agreement still fails.',
      },
    },
    19: {
      summary:
        '"Conservation scientist" does not identify anyone by itself, so the name that follows is essential information. Essential appositives take no commas.',
      choices: {
        A: 'Correct. The name is needed to identify which scientist, so it runs on with no punctuation.',
        B: 'A single comma cuts the subject off from the rest of the sentence.',
        C: 'A colon needs a complete clause before it, and "There, conservation scientist" is not one.',
        D: 'Paired commas mark the name as nonessential, but "conservation scientist" is not specific enough for the name to be droppable.',
      },
    },
    20: {
      summary:
        'The subject is "lost works like the Wakefield Master’s miracle play" - plural "works." The title and the dashed aside sit between the subject and the verb, but they do not change what the verb has to agree with.',
      choices: {
        A: '"Becomes" is singular, agreeing with the intervening title rather than with "works."',
        B: '"Is becoming" is singular too, and the progressive clashes with the settled state being described.',
        C: '"Has become" is singular, so it fails the same agreement test.',
        D: 'Correct. "Have become" agrees with the plural subject "lost works."',
      },
    },
    21: {
      summary:
        'The sentence already has its main verb: "ensured." The blank needs a form that modifies "An electromagnetic coil" rather than a second finite verb.',
      choices: {
        A: '"Focused the beam" reads as a second finite verb, leaving the sentence with two predicates.',
        B: '"Focuses" is a finite verb, which collides with "ensured."',
        C: 'Correct. The participle "focusing" modifies the coil, and "ensured" remains the sentence’s only main verb.',
        D: '"Focus" is another finite form and also fails to agree with the singular subject.',
      },
    },
    22: {
      summary:
        'Almost 36,000 feet versus about 1,000 feet - the two sentences set the new submersible against its predecessor. The transition has to mark that opposition.',
      choices: {
        A: '"Therefore" claims the second fact follows from the first, but the predecessor’s limit is not a consequence of the new craft’s depth.',
        B: '"Secondly" would place the sentences in a list, and this is a comparison of two vessels.',
        C: '"Similarly" says the two facts match, when the depths differ by a factor of more than thirty.',
        D: 'Correct. "By contrast" marks the gap between the submersible’s depth and its predecessor’s.',
      },
    },
    23: {
      summary:
        'Lossless compression keeps files in the kilobyte range; uncompressed storage needs larger, costlier systems for megabyte files. The second sentence draws the conclusion that follows from the first.',
      choices: {
        A: '"Instead" signals a replacement or correction, and nothing is being swapped out.',
        B: '"Specifically" narrows to a detail, but the second sentence generalizes to an efficiency claim.',
        C: 'Correct. "As such" presents the efficiency claim as the consequence of the smaller file sizes just described.',
        D: '"For example" needs an instance of the previous claim, and this is a conclusion drawn from it.',
      },
    },
    24: {
      summary:
        'The second sentence restates what "sporadic" means for the 1833 meteors: they appeared randomly rather than radiating from one constellation. That is a definition of the word just used.',
      choices: {
        A: '"For example" introduces an instance, but this sentence explains the term instead of illustrating it with a case.',
        B: 'Correct. "That is" introduces the restatement that defines "sporadic."',
        C: '"Meanwhile" marks something happening at the same time elsewhere, not a clarification.',
        D: '"Nonetheless" concedes a contrast, and the sentence agrees with what precedes it.',
      },
    },
    25: {
      summary:
        'The goal is to indicate the size of the preserve, so the choice has to carry the acreage from the notes.',
      choices: {
        A: 'Correct. It gives the 729,000-acre figure, which is the size the student wants to convey.',
        B: 'It names the location and the panther but never the size.',
        C: 'It covers management and the panther, with no acreage.',
        D: 'It focuses on management and vehicle restrictions instead of size.',
      },
    },
    26: {
      summary:
        'The goal is a difference. The notes contrast black-and-white documentary street scenes with color staged conceptual scenes, so the choice has to set the two works against each other.',
      choices: {
        A: 'Both artists using photography is a similarity, not a difference.',
        B: 'Both works being made from images is also a similarity.',
        C: 'Correct. "Unlike Walsh’s work" sets documentary scenes against Tanaka’s staged conceptual ones.',
        D: '"Like Constructed Dreams No. 3" states what the works share.',
      },
    },
    27: {
      summary:
        'The goal is how long Volkov competed, so the choice has to give the span of her career: 1996 to 2008.',
      choices: {
        A: 'It emphasizes her medal count and gives no dates.',
        B: 'Correct. It states that she competed as a long jumper from 1996 to 2008, which is the length of her career.',
        C: 'The 1896 claim is not in the notes, and the sentence is about the sport rather than her career span.',
        D: 'It gives both athletes’ debut years but never says when Volkov stopped competing.',
      },
    },
  },
}
