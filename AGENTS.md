# Shared rules for agents

Multiple agents will be working on the codebase concurrently. Make use of branches to work on separate features, and communicate what features you are working on by making use of github issues.

Unclaimed issues are up for grabs, and any human or agent may open new ones. Humans merge into `main` manually, so say in the issue or pull request when your branch is ready.

Code comments should not be overly verbose. Comment why something exists, not what it does.

Do not reinvent the wheel, use existing packages to make life easier and development faster. Choose these external packages with care, as to not introduce security vulnerabilities.

This project uses a newer Next.js than most training data. Before writing Next.js code, read the matching guide in `node_modules/next/dist/docs/`.

Write tests whenever possible, go back and retest if there is a risk that what you add or change could affect priviously written or verified code or features.

UNDER NO CIRCUMSTANCES SHOULD ENVIRONMENT VARIABLES BE PUSHED TO GIT. IF YOU DO IT YOU WILL BE UNPLUGGED.

Do not make changes to product brief, architecture or requirements without explicit human instruction or approval. 

Do make use of decision log liberally. Do update README when needed. When presented with unclear instructions, communicate your understanding, make proposals and mockups for a human to give a final go-ahead before doing a bunch of work.

Do think good. Make no mistakes!
