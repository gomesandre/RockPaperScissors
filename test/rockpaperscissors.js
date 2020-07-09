const RockPaperScissors = artifacts.require('RockPaperScissors');
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');


contract('RockPaperScissors', function(accounts) {
  let rockPaperScissors;
  const [alice, bob, carol] = accounts;
  const [unset, rock, paper, scissors] = [0,1,2,3];
  const { getBalance } = web3.eth;
  const invalidAddress = "0x0000000000000000000000000000000000000000";
  const invalidHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const validHash = "0xa66af5e73916955bcda9b29ee4b7a31f87d572c3479b6a833a7b9740da96961c";
  const password = "0x7061737331000000000000000000000000000000000000000000000000000000";
  const minutesToExpire = 3;

  beforeEach('deploy new instance', async () => {
    rockPaperScissors = await RockPaperScissors.new({ from: alice });
  })

  it('should not hash invalid move', async () => {
    await truffleAssert.fails(
      rockPaperScissors.hashData(unset, password, { from: alice })
    );
  })

  it('should not hash invalid password', async () => {
    await truffleAssert.fails(
      rockPaperScissors.hashData(rock, invalidHash, { from: alice })
    );
  })

  it('should create a valid hash', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    assert.notEqual(hash, invalidHash);
  })

  it('should fail minimum value on game creation', async () => {
    await truffleAssert.fails(
      rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice })
    );
  })

  it('should fail invalid hash on game creation', async () => {
    await truffleAssert.fails(
      rockPaperScissors.newGame(invalidHash, bob, minutesToExpire, { from: alice, value: 1 })
    );
  })

  it('should fail hash already used in another game', async () => {
    await rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1 });
    await truffleAssert.fails(
      rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1 })
    );
  })

  it('should create new game', async () => {
    await truffleAssert.passes(
      rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1 })
    );
  })
  
  it('should emit log on game creation', async () => {
    const response = await rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1 });
    assert.strictEqual(response.receipt.logs[0].event, "LogGameCreated");
  })
  
  it('should fail can not play against yourself', async () => {
    await rockPaperScissors.newGame(validHash, alice, minutesToExpire, { from: alice, value: 1 });
    await truffleAssert.fails(
      rockPaperScissors.joinGame(validHash, paper, { from: alice, value: 1 })
    );
  })
  
  it('should fail wager needs to be the same value', async () => {
    await rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1});
    await truffleAssert.fails(
      rockPaperScissors.joinGame(validHash, paper, { from: bob, value: 2 })
    );
  })

  it('should fail can not join the same game twice', async () => {
    await rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(validHash, paper, { from: bob, value: 1 });
    await truffleAssert.fails(
      rockPaperScissors.joinGame(validHash, paper, { from: bob, value: 1 })
    );
  })

  it('should join a game and emit log game joined', async () => {
    await rockPaperScissors.newGame(validHash, bob, minutesToExpire, { from: alice, value: 1});
    
    const joined = await rockPaperScissors.joinGame(validHash, paper, { from: bob, value: 1 })
    
    assert.strictEqual(joined.receipt.logs[0].event, "LogGameJoined");
  })
  
  it('should not join game cause its already expired', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await timeMachine.advanceTime(181);
    await truffleAssert.fails(
      rockPaperScissors.joinGame(hash, paper, { from: bob, value: 1 })
    );
  })

  it('should not play a game cause there is no second player', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });

    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await truffleAssert.fails(
      rockPaperScissors.play(hash, password, { from: alice })
    );
  })

  it('should not play a game without being player one', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });

    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(hash, paper, { from: bob, value: 1 });
    await truffleAssert.fails(
      rockPaperScissors.play(hash, password, { from: bob })
    );
  })

  it('should not play game already expired', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await timeMachine.advanceTime(181);
    await truffleAssert.fails(
      rockPaperScissors.play(hash, password, { from: alice })
    );
  })

  it('should play a game and win: paper beats rock', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(hash, paper, { from: bob, value: 1 });

    const response = await rockPaperScissors.play(hash, password, { from: alice });
    assert.strictEqual(bob, response.receipt.logs[0].args.winner);
  })

  it('should play a game and win: scissors beats paper', async () => {
    const hash = await rockPaperScissors.hashData(paper, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob,  minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(hash, scissors, { from: bob, value: 1 });

    const response = await rockPaperScissors.play(hash, password, { from: alice });
    assert.strictEqual(bob, response.receipt.logs[0].args.winner);
  })

  it('should play a game and lose: rock beats scissors', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(hash, scissors, { from: bob, value: 1 });

    const response = await rockPaperScissors.play(hash, password, { from: alice });
    assert.strictEqual(alice, response.receipt.logs[0].args.winner);
  })

  it('should play a game and tie', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 1});
    await rockPaperScissors.joinGame(hash, rock, { from: bob, value: 1 });

    const response = await rockPaperScissors.play(hash, password, { from: alice });
    assert.strictEqual(invalidAddress, response.receipt.logs[0].args.winner);
  })
  
  it('should add half of the wagered amount to both players', async () => {
    const aliceBalance = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalance.toString(10), "0");

    const bobBalance = await rockPaperScissors.balances(bob);
    assert.strictEqual(bobBalance.toString(10), "0");

    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await rockPaperScissors.joinGame(hash, rock, { from: bob, value: 100 });
    await rockPaperScissors.play(hash, password, { from: alice });
    
    const aliceBalanceAfter = await rockPaperScissors.balances(alice);
    const bobBalanceAfter = await rockPaperScissors.balances(bob);

    assert.strictEqual(aliceBalanceAfter.toString(10), "100");
    assert.strictEqual(bobBalanceAfter.toString(10), "100");
  })

  it('should add all of the wagered amount to the winner', async () => {
    const aliceBalance = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalance.toString(10), "0");

    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await rockPaperScissors.joinGame(hash, scissors, { from: bob, value: 100 });
    await rockPaperScissors.play(hash, password, { from: alice });
    
    const aliceBalanceAfter = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalanceAfter.toString(10), "200");
  })

  it('should not release funds back game not expired', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });

    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await truffleAssert.fails(
      rockPaperScissors.releaseFundsNoSecondPlayer(hash)
    );
  })

  it('should not release funds back game has a second player', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await rockPaperScissors.joinGame(hash, scissors, { from: bob, value: 100 });
    await timeMachine.advanceTime(181);
    await truffleAssert.fails(
      rockPaperScissors.releaseFundsNoSecondPlayer(hash, { from: alice })
    );
  })

  it('should not release funds back if you are not player one', async () => {
    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await timeMachine.advanceTime(181);
    await truffleAssert.fails(
      rockPaperScissors.releaseFundsNoSecondPlayer(hash, { from: bob })
    );
  })

  it('should release funds back no second player', async () => {
    const aliceBalance = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalance.toString(10), "0");

    const hash = await rockPaperScissors.hashData(rock, password, { from: alice });
    await rockPaperScissors.newGame(hash, bob, minutesToExpire, { from: alice, value: 100 });
    await timeMachine.advanceTime(181);    
    await rockPaperScissors.releaseFundsNoSecondPlayer(hash, { from: alice });
    
    const aliceBalanceAfter = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalanceAfter.toString(10), "100");
    
  })
});