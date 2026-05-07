 ## Short term planned items

 ### Definition
 HOD = Human overlord developer, the human who asked you to take a look into this file. 
 Or the human that supervise the process that sked you to take a look into this file

 ### Instructions
 - The list of proposed items listed in a block below this one.
 - Each item might contain the sublist of items
 - The statuses are appied to the root level of the list as well as for the nested levels of lists
 - Possible statuses of the items:
    - No status = just created
    - DONE = already implemented and awaiting for verification
    - VERIFIED = implemented and verified, no futher action needed. Awaiting deletion from the list
    - REDO = the task was done, however HOD decided that the task needs enchancements. The list of enchancements will be listed as a sublist of the main list.
 - Once the item is done: mark it with [DONE]. 
 - HOD will manually verify the item and mark it either [VERIFIED] or [REDO].
 - [VERIFIED] items need no action, they awaiting deletion.
 - [REDO] Items require some work on it. Details will be listed in the nested sublists of the items.

 ### List of items to implement
 - [REDO] When all surviors are dead: The time now flows with normal speed like is the space key is pressed with normal 1x speed. None of the control are availble to user from now on in this game session on the game map. During this time the screen gets a little dim and the menu appears with the sign that all the squad are dead and options that existing now: replay or main menu or decrease the complexity of the round. The time between the death of heroes and the screen should be 2 seconds. We should also come up with the different messages for this case. Messages require additional approval and suggestions, we have to have them comfigurable in a list, and select randomly. For one failure session, 1 message is selected, options of the messages are: "A**L Snakes won this time", "Surviours is dead, but not your fight", "Humanity lost this round, but do you have a power for another one?", "They payed biggest price for humanity, now your action". Feel free to add up to 20 messages, fix the english and grammar in this messages.
    - Estimate the current state of the project, create the additional doc with name "died_consitions.md" and add your suggestions there for implementing this change.
 - [VERIFIED] Make the mouse selection in the main menu in a form of hockey club
 - [REDO] special abilities like gun, catana, medkit usage or other pickd ite usage should be visiblein the hero's hud with the timing on the when the ebility ends. Medkit does not instantly restores hP, it restores hp over time. Introduce new time of rare medkit of blue color or contour that heals better than the current gree one.
    - the status should show the hint on mouse over with human readable message of the effect
 - Each ability should be modular. Even the abilities that are basic for the hero should be interchangeable, even passive abilities. The abilities should be piled up in a single file " abilities" and another files will map the aiblities to the heroes. The ability will have sound ( optional , as passive do not need those), icon, other parameter that this ability might have like cooldown or active period. These last parameters will be custom map of parameters for each ability. E.G. the smashing_time ability will not have the parameter of execution, as it is instant, it will have the cooldown. At the same time the flamethrower of acid gun could have the parameters of duration, intencity and cooldown.
    - If you suggest that this items does not have all the information for the implementation: create the file "abilities_structure_rework.md" here and we can work though this doc. If everything is clear and there are not much of a questions: just move ahead with the implementation.