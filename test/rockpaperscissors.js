const RockPaperScissors = artifacts.require('RockPaperScissors');
const truffleAssert = require('truffle-assertions');

contract('RockPaperScissors', function(accounts) {
  let rockPaperScissors;
  const [alice, bob, carol] = accounts;
  const [rock, paper, scissors, invalidOption] = [0,1,2,3];
  const { getBalance } = web3.eth;
  const invalidAddress = "0x0000000000000000000000000000000000000000";
  const invalidGameID = "0x0000000000000000000000000000000000000000000000000000000000000000";

  beforeEach('deploy new instance', async () => {
    rockPaperScissors = await RockPaperScissors.new({ from: alice });
  })

  it('should fail minimum value on game creation', async () => {
    await truffleAssert.fails(
      rockPaperScissors.newGame(rock, { from: alice })
    );
  })

  it('should fail invalid opcode', async () => {
    await truffleAssert.fails(
      rockPaperScissors.newGame(invalidOption, { from: alice })
    );
  })

  it('should create new game', async () => {
    await truffleAssert.passes(
      rockPaperScissors.newGame(rock, { from: alice, value: 1 })
    );
  })
  
  it('should emit log on game creation', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});

    assert.strictEqual(response.receipt.logs[0].event, "LogGameCreated");
  })
  
  it('should fail can not play against yourself', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;

    await truffleAssert.fails(
      rockPaperScissors.joinGame(gameID, paper, { from: alice })
    );
  })

  it('should fail mining value on game join', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;

    await truffleAssert.fails(
      rockPaperScissors.joinGame(gameID, paper, { from: bob })
    );
  })
  
  it('should fail wager needs to be the same value', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;

    await truffleAssert.fails(
      rockPaperScissors.joinGame(gameID, paper, { from: bob, value: 2 })
    );
  })

  it('should join game and emit log game joined', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, paper, { from: bob, value: 1 })
    assert.strictEqual(joined.receipt.logs[0].event, "LogGameJoined");
  })
  
  it('should check winner and emit log with game result', async () => {
    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, scissors, { from: bob, value: 1 });
    assert.strictEqual(joined.receipt.logs[1].event, "LogGameResult");
  })
  
  it('should join game an win: rock vs paper', async () => {
    const response = await rockPaperScissors.newGame(rock, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, paper, { from: bob, value: 1 });
    assert.strictEqual(bob, joined.receipt.logs[1].args.winner);
  })

  it('should join game an lose: scissors vs paper', async () => {
    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, paper, { from: bob, value: 1 });
    assert.strictEqual(alice, joined.receipt.logs[1].args.winner);
  })

  it('should join game an win: scissors vs rock', async () => {
    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, rock, { from: bob, value: 1 });
    assert.strictEqual(bob, joined.receipt.logs[1].args.winner);
  })

  it('should join game and tie', async () => {
    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 1});
    const gameID = response.receipt.logs[0].args.gameID;
    
    const joined = await rockPaperScissors.joinGame(gameID, scissors, { from: bob, value: 1 });
    assert.strictEqual(invalidAddress, joined.receipt.logs[1].args.winner);
  })
  
  it('should add half of the wagered amount to both players', async () => {
    const aliceBalance = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalance.toString(10), "0");

    const bobBalance = await rockPaperScissors.balances(bob);
    assert.strictEqual(bobBalance.toString(10), "0");

    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 100 });
    const gameID = response.receipt.logs[0].args.gameID;
    
    await rockPaperScissors.joinGame(gameID, scissors, { from: bob, value: 100 });
    
    const aliceBalanceAfter = await rockPaperScissors.balances(alice);
    const bobBalanceAfter = await rockPaperScissors.balances(bob);

    assert.strictEqual(aliceBalanceAfter.toString(10), "100");
    assert.strictEqual(bobBalanceAfter.toString(10), "100");
  })

  it('should add all of the wagered amount to the winner', async () => {
    const aliceBalance = await rockPaperScissors.balances(alice);
    assert.strictEqual(aliceBalance.toString(10), "0");

    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 100 });
    const gameID = response.receipt.logs[0].args.gameID;
    
    await rockPaperScissors.joinGame(gameID, paper, { from: bob, value: 100 });
    
    const aliceBalanceAfter = await rockPaperScissors.balances(alice);

    assert.strictEqual(aliceBalanceAfter.toString(10), "200");
  })

  it('should not release funds back game not expired', async () => {
    const response = await rockPaperScissors.newGame(scissors, { from: alice, value: 100 });
    const gameID = response.receipt.logs[0].args.gameID;

    await truffleAssert.fails(
      rockPaperScissors.claimWagerExpiredGame(gameID)
    );
  })
});